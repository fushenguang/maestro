use sqlx::SqlitePool;

use crate::commands::profiles::new_id;
use crate::error::AppError;

/// Enqueue a write operation for Supabase sync.
///
/// - `table`:     target Supabase table name
/// - `row_id`:    primary key of the affected row
/// - `operation`: `"upsert"` or `"delete"`
/// - `payload`:   JSON-serialised row data (for upsert) or `"{}"` (for delete)
pub async fn enqueue(
    pool: &SqlitePool,
    table: &str,
    row_id: &str,
    operation: &str,
    payload: &str,
) -> Result<(), AppError> {
    let id = new_id();
    let now = chrono::Utc::now()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    sqlx::query(
        r#"
        INSERT INTO sync_queue (id, table_name, row_id, operation, payload, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(table)
    .bind(row_id)
    .bind(operation)
    .bind(payload)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    Ok(())
}
