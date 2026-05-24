use sqlx::SqlitePool;

use crate::error::AppError;
use super::profiles::{new_id, now_utc};
use crate::sync::queue::enqueue;

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Idea {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub slug: Option<String>,
    pub description: Option<String>,
    pub tags: String, // JSON array
    pub creator_mode: String,
    pub product_stage: String,
    pub stage_entered_at: Option<String>,
    pub current_phase: i64,
    pub status: String,
    pub feed_source_type: Option<String>,
    pub feed_source_url: Option<String>,
    pub feed_raw_content: Option<String>,
    pub feed_completed_at: Option<String>,
    pub intent_clarity: i64,
    pub intent_rounds: i64,
    pub open_questions_count: i64,
    pub intent_completed_at: Option<String>,
    pub problem_statement: Option<String>,
    pub boundary_locked_at: Option<String>,
    pub boundary_export_sha: Option<String>,
    pub validation_verdict: Option<String>,
    pub validation_completed_at: Option<String>,
    pub contract_signed_at: Option<String>,
    pub contract_id: Option<String>,
    pub product_type: Option<String>,
    pub deadline: Option<String>,
    pub success_metric: Option<String>,
    pub target_n: Option<i64>,
    pub deadline_extensions_used: i64,
    pub extension_post_url: Option<String>,
    pub current_version: String,
    pub github_repo: Option<String>,
    pub github_repo_node_id: Option<String>,
    pub market_current_value: i64,
    pub market_last_checked_at: Option<String>,
    pub market_visible: bool,
    pub postmortem_report: Option<String>,
    pub postmortem_at: Option<String>,
    pub cooling_ends_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIdeaInput {
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub creator_mode: Option<String>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateIdeaInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub status: Option<String>,
    pub current_phase: Option<i64>,
    pub feed_source_type: Option<String>,
    pub feed_source_url: Option<String>,
    pub feed_raw_content: Option<String>,
    pub feed_completed_at: Option<String>,
    pub intent_clarity: Option<i64>,
    pub intent_rounds: Option<i64>,
    pub open_questions_count: Option<i64>,
    pub intent_completed_at: Option<String>,
    pub problem_statement: Option<String>,
    pub boundary_export_sha: Option<String>,
    pub validation_verdict: Option<String>,
    pub validation_completed_at: Option<String>,
    pub product_type: Option<String>,
    pub deadline: Option<String>,
    pub success_metric: Option<String>,
    pub target_n: Option<i64>,
    pub github_repo: Option<String>,
    pub current_version: Option<String>,
    pub postmortem_report: Option<String>,
}

#[tauri::command]
pub async fn get_ideas(
    pool: tauri::State<'_, SqlitePool>,
) -> Result<Vec<Idea>, AppError> {
    let ideas = sqlx::query_as::<_, Idea>(
        "SELECT * FROM ideas ORDER BY updated_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(ideas)
}

#[tauri::command]
pub async fn get_idea(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<Idea, AppError> {
    let idea = sqlx::query_as::<_, Idea>("SELECT * FROM ideas WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::NotFound(id))?;

    Ok(idea)
}

#[tauri::command]
pub async fn create_idea(
    pool: tauri::State<'_, SqlitePool>,
    data: CreateIdeaInput,
) -> Result<Idea, AppError> {
    let id = new_id();
    let now = now_utc();
    let tags = serde_json::to_string(&data.tags.unwrap_or_default())
        .unwrap_or_else(|_| "[]".to_string());
    let creator_mode = data.creator_mode.unwrap_or_else(|| "technical".to_string());

    sqlx::query(
        r#"
        INSERT INTO ideas (
          id, user_id, name, description, tags, creator_mode, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&data.user_id)
    .bind(&data.name)
    .bind(&data.description)
    .bind(&tags)
    .bind(&creator_mode)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let idea = sqlx::query_as::<_, Idea>("SELECT * FROM ideas WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from)?;

    // Enqueue for Supabase sync
    let payload = serde_json::to_string(&idea).unwrap_or_default();
    let _ = enqueue(pool.inner(), "ideas", &id, "upsert", &payload).await;

    Ok(idea)
}

#[tauri::command]
pub async fn update_idea(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
    data: UpdateIdeaInput,
) -> Result<Idea, AppError> {
    // Fetch current state for contract immutability check
    let current = sqlx::query_as::<_, Idea>("SELECT * FROM ideas WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::NotFound(id.clone()))?;

    // Contract immutability guard: if contract_signed_at is set, reject mutations
    // to deadline, success_metric, target_n, product_type.
    if current.contract_signed_at.is_some() {
        if data.deadline.is_some()
            || data.success_metric.is_some()
            || data.target_n.is_some()
            || data.product_type.is_some()
        {
            return Err(AppError::ContractImmutable(id));
        }
    }

    let now = now_utc();
    let tags = data
        .tags
        .map(|t| serde_json::to_string(&t).unwrap_or_else(|_| "[]".to_string()));

    // Build dynamic SET clause
    sqlx::query(
        r#"
        UPDATE ideas SET
          name                    = COALESCE(?, name),
          description             = COALESCE(?, description),
          tags                    = COALESCE(?, tags),
          status                  = COALESCE(?, status),
          current_phase           = COALESCE(?, current_phase),
          feed_source_type        = COALESCE(?, feed_source_type),
          feed_source_url         = COALESCE(?, feed_source_url),
          feed_raw_content        = COALESCE(?, feed_raw_content),
          feed_completed_at       = COALESCE(?, feed_completed_at),
          intent_clarity          = COALESCE(?, intent_clarity),
          intent_rounds           = COALESCE(?, intent_rounds),
          open_questions_count    = COALESCE(?, open_questions_count),
          intent_completed_at     = COALESCE(?, intent_completed_at),
          problem_statement       = COALESCE(?, problem_statement),
          boundary_export_sha     = COALESCE(?, boundary_export_sha),
          validation_verdict      = COALESCE(?, validation_verdict),
          validation_completed_at = COALESCE(?, validation_completed_at),
          product_type            = COALESCE(?, product_type),
          deadline                = COALESCE(?, deadline),
          success_metric          = COALESCE(?, success_metric),
          target_n                = COALESCE(?, target_n),
          github_repo             = COALESCE(?, github_repo),
          current_version         = COALESCE(?, current_version),
          postmortem_report       = COALESCE(?, postmortem_report),
          updated_at              = ?
        WHERE id = ?
        "#,
    )
    .bind(&data.name)
    .bind(&data.description)
    .bind(&tags)
    .bind(&data.status)
    .bind(data.current_phase)
    .bind(&data.feed_source_type)
    .bind(&data.feed_source_url)
    .bind(&data.feed_raw_content)
    .bind(&data.feed_completed_at)
    .bind(data.intent_clarity)
    .bind(data.intent_rounds)
    .bind(data.open_questions_count)
    .bind(&data.intent_completed_at)
    .bind(&data.problem_statement)
    .bind(&data.boundary_export_sha)
    .bind(&data.validation_verdict)
    .bind(&data.validation_completed_at)
    .bind(&data.product_type)
    .bind(&data.deadline)
    .bind(&data.success_metric)
    .bind(data.target_n)
    .bind(&data.github_repo)
    .bind(&data.current_version)
    .bind(&data.postmortem_report)
    .bind(&now)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let updated = sqlx::query_as::<_, Idea>("SELECT * FROM ideas WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from)?;

    let payload = serde_json::to_string(&updated).unwrap_or_default();
    let _ = enqueue(pool.inner(), "ideas", &id, "upsert", &payload).await;

    Ok(updated)
}

#[tauri::command]
pub async fn delete_idea(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), AppError> {
    // Only allow deletion of draft ideas
    let idea = sqlx::query_as::<_, Idea>("SELECT * FROM ideas WHERE id = ?")
        .bind(&id)
        .fetch_optional(pool.inner())
        .await
        .map_err(AppError::from)?
        .ok_or_else(|| AppError::NotFound(id.clone()))?;

    if idea.status != "draft" {
        return Err(AppError::ValidationError(
            "Only draft ideas can be deleted".to_string(),
        ));
    }

    sqlx::query("DELETE FROM ideas WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(AppError::from)?;

    let _ = enqueue(pool.inner(), "ideas", &id, "delete", "{}").await;

    Ok(())
}
