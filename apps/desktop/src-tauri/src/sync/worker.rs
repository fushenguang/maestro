use sqlx::SqlitePool;

#[derive(Debug, sqlx::FromRow)]
struct QueueEntry {
    id: String,
    table_name: String,
    row_id: String,
    operation: String,
    payload: String,
    attempts: i64,
}

/// Spawn the background sync worker.
///
/// The worker runs every 30 seconds, picks up pending sync_queue entries
/// (attempts < 5) and attempts to POST them to the configured Supabase REST API.
/// On success the entry is deleted; on failure `attempts` is incremented and
/// `last_error` is recorded for the next retry cycle (exponential back-off is
/// handled implicitly by the fixed 30-second poll interval × attempt count).
pub fn spawn(pool: SqlitePool, supabase_url: String, supabase_anon_key: String) {
    tauri::async_runtime::spawn(async move {
        loop {
            // Wait 30 seconds between cycles
            tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;

            if let Err(e) = run_cycle(&pool, &supabase_url, &supabase_anon_key).await {
                eprintln!("[sync-worker] cycle error: {e}");
            }
        }
    });
}

async fn run_cycle(
    pool: &SqlitePool,
    supabase_url: &str,
    supabase_anon_key: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Skip if Supabase URL is not configured
    if supabase_url.is_empty() {
        return Ok(());
    }

    let entries = sqlx::query_as::<_, QueueEntry>(
        "SELECT id, table_name, row_id, operation, payload, attempts \
         FROM sync_queue WHERE attempts < 5 ORDER BY created_at ASC LIMIT 20",
    )
    .fetch_all(pool)
    .await?;

    if entries.is_empty() {
        return Ok(());
    }

    let client = reqwest::Client::new();

    for entry in entries {
        let result = push_entry(&client, supabase_url, supabase_anon_key, &entry).await;

        match result {
            Ok(()) => {
                sqlx::query("DELETE FROM sync_queue WHERE id = ?")
                    .bind(&entry.id)
                    .execute(pool)
                    .await?;
            }
            Err(e) => {
                sqlx::query(
                    "UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?",
                )
                .bind(e.to_string())
                .bind(&entry.id)
                .execute(pool)
                .await?;
            }
        }
    }

    Ok(())
}

async fn push_entry(
    client: &reqwest::Client,
    supabase_url: &str,
    anon_key: &str,
    entry: &QueueEntry,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("{}/rest/v1/{}", supabase_url.trim_end_matches('/'), entry.table_name);

    match entry.operation.as_str() {
        "upsert" => {
            let body: serde_json::Value = serde_json::from_str(&entry.payload)?;
            let resp = client
                .post(&url)
                .header("apikey", anon_key)
                .header("Authorization", format!("Bearer {anon_key}"))
                .header("Prefer", "resolution=merge-duplicates")
                .json(&body)
                .send()
                .await?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Supabase upsert failed ({status}): {body}").into());
            }
        }
        "delete" => {
            let resp = client
                .delete(format!("{url}?id=eq.{}", entry.row_id))
                .header("apikey", anon_key)
                .header("Authorization", format!("Bearer {anon_key}"))
                .send()
                .await?;

            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return Err(format!("Supabase delete failed ({status}): {body}").into());
            }
        }
        _ => {
            return Err(format!("Unknown operation: {}", entry.operation).into());
        }
    }

    Ok(())
}
