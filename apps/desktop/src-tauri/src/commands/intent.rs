use sqlx::SqlitePool;

use crate::error::AppError;
use super::profiles::{new_id, now_utc};

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct IntentCanvas {
    pub id: String,
    pub idea_id: String,
    pub problem: Option<String>,
    pub root_cause: Option<String>,
    pub mechanism: Option<String>,
    pub target_user: Option<String>,
    pub success_metric_desc: Option<String>,
    pub boundary_hint: Option<String>,
    pub problem_confidence: Option<i64>,
    pub root_cause_confidence: Option<i64>,
    pub mechanism_confidence: Option<i64>,
    pub target_user_confidence: Option<i64>,
    pub updated_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertIntentCanvasInput {
    pub idea_id: String,
    pub problem: Option<String>,
    pub root_cause: Option<String>,
    pub mechanism: Option<String>,
    pub target_user: Option<String>,
    pub success_metric_desc: Option<String>,
    pub boundary_hint: Option<String>,
    pub problem_confidence: Option<i64>,
    pub root_cause_confidence: Option<i64>,
    pub mechanism_confidence: Option<i64>,
    pub target_user_confidence: Option<i64>,
}

#[tauri::command]
pub async fn get_intent_canvas(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Option<IntentCanvas>, AppError> {
    let canvas = sqlx::query_as::<_, IntentCanvas>(
        "SELECT * FROM intent_canvas WHERE idea_id = ?",
    )
    .bind(&idea_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(canvas)
}

#[tauri::command]
pub async fn upsert_intent_canvas(
    pool: tauri::State<'_, SqlitePool>,
    data: UpsertIntentCanvasInput,
) -> Result<IntentCanvas, AppError> {
    let now = now_utc();

    // Check if a canvas already exists for this idea
    let existing = sqlx::query_scalar::<_, String>(
        "SELECT id FROM intent_canvas WHERE idea_id = ?",
    )
    .bind(&data.idea_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(AppError::from)?;

    let id = existing.unwrap_or_else(new_id);

    sqlx::query(
        r#"
        INSERT INTO intent_canvas (
          id, idea_id, problem, root_cause, mechanism, target_user,
          success_metric_desc, boundary_hint,
          problem_confidence, root_cause_confidence,
          mechanism_confidence, target_user_confidence, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(idea_id) DO UPDATE SET
          problem                = COALESCE(excluded.problem, problem),
          root_cause             = COALESCE(excluded.root_cause, root_cause),
          mechanism              = COALESCE(excluded.mechanism, mechanism),
          target_user            = COALESCE(excluded.target_user, target_user),
          success_metric_desc    = COALESCE(excluded.success_metric_desc, success_metric_desc),
          boundary_hint          = COALESCE(excluded.boundary_hint, boundary_hint),
          problem_confidence     = COALESCE(excluded.problem_confidence, problem_confidence),
          root_cause_confidence  = COALESCE(excluded.root_cause_confidence, root_cause_confidence),
          mechanism_confidence   = COALESCE(excluded.mechanism_confidence, mechanism_confidence),
          target_user_confidence = COALESCE(excluded.target_user_confidence, target_user_confidence),
          updated_at             = excluded.updated_at
        "#,
    )
    .bind(&id)
    .bind(&data.idea_id)
    .bind(&data.problem)
    .bind(&data.root_cause)
    .bind(&data.mechanism)
    .bind(&data.target_user)
    .bind(&data.success_metric_desc)
    .bind(&data.boundary_hint)
    .bind(data.problem_confidence)
    .bind(data.root_cause_confidence)
    .bind(data.mechanism_confidence)
    .bind(data.target_user_confidence)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let canvas = sqlx::query_as::<_, IntentCanvas>(
        "SELECT * FROM intent_canvas WHERE idea_id = ?",
    )
    .bind(&data.idea_id)
    .fetch_one(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(canvas)
}
