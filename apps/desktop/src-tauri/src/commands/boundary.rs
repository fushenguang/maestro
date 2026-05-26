use sqlx::SqlitePool;

use crate::error::AppError;
use super::profiles::{new_id, now_utc};

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ScopeItem {
    pub id: String,
    pub idea_id: String,
    pub r#type: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub tags: String, // JSON array
    pub source: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertScopeItemInput {
    pub id: Option<String>,
    pub idea_id: String,
    pub r#type: String,
    pub title: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub tags: Option<Vec<String>>,
    pub source: Option<String>,
    pub sort_order: Option<i64>,
}

#[tauri::command]
pub async fn get_scope_items(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Vec<ScopeItem>, AppError> {
    let items = sqlx::query_as::<_, ScopeItem>(
        "SELECT * FROM scope_items WHERE idea_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(&idea_id)
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(items)
}

#[tauri::command]
pub async fn upsert_scope_item(
    pool: tauri::State<'_, SqlitePool>,
    data: UpsertScopeItemInput,
) -> Result<ScopeItem, AppError> {
    let id = data.id.unwrap_or_else(new_id);
    let now = now_utc();
    let tags = serde_json::to_string(&data.tags.unwrap_or_default())
        .unwrap_or_else(|_| "[]".to_string());
    let status = data.status.unwrap_or_else(|| "pending".to_string());
    let source = data.source.unwrap_or_else(|| "opus".to_string());
    let sort_order = data.sort_order.unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO scope_items (id, idea_id, type, title, description, status, tags, source, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type       = excluded.type,
          title      = excluded.title,
          description = excluded.description,
          status     = excluded.status,
          tags       = excluded.tags,
          source     = excluded.source,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at
        "#,
    )
    .bind(&id)
    .bind(&data.idea_id)
    .bind(&data.r#type)
    .bind(&data.title)
    .bind(&data.description)
    .bind(&status)
    .bind(&tags)
    .bind(&source)
    .bind(sort_order)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let item = sqlx::query_as::<_, ScopeItem>("SELECT * FROM scope_items WHERE id = ?")
        .bind(&id)
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from)?;

    Ok(item)
}

#[tauri::command]
pub async fn delete_scope_item(
    pool: tauri::State<'_, SqlitePool>,
    id: String,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM scope_items WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(AppError::from)?;

    Ok(())
}

/// Delete all scope items with source='opus' for an idea (for re-analyze).
#[tauri::command]
pub async fn delete_scope_items_by_source(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
    source: String,
) -> Result<(), AppError> {
    sqlx::query("DELETE FROM scope_items WHERE idea_id = ? AND source = ?")
        .bind(&idea_id)
        .bind(&source)
        .execute(pool.inner())
        .await
        .map_err(AppError::from)?;

    Ok(())
}

/// Lock the boundary for an idea.
/// Requires all open questions to be resolved (not `needs_confirm`).
#[tauri::command]
pub async fn lock_boundary(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<(), AppError> {
    // Open questions must be resolved before locking boundary.
    let unresolved_open_questions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM scope_items WHERE idea_id = ? AND type = 'open_question' AND status = 'needs_confirm'",
    )
    .bind(&idea_id)
    .fetch_one(pool.inner())
    .await
    .map_err(AppError::from)?;

    if unresolved_open_questions > 0 {
        return Err(AppError::ValidationError(format!(
            "{unresolved_open_questions} open questions are not yet resolved"
        )));
    }

    let now = now_utc();
    sqlx::query("UPDATE ideas SET boundary_locked_at = ?, updated_at = ? WHERE id = ?")
        .bind(&now)
        .bind(&now)
        .bind(&idea_id)
        .execute(pool.inner())
        .await
        .map_err(AppError::from)?;

    Ok(())
}
