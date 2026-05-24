use sqlx::SqlitePool;

use crate::error::AppError;
use super::profiles::{new_id, now_utc};

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionNode {
    pub id: String,
    pub idea_id: String,
    pub version: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub node_date: Option<String>,
    pub shipped_at: Option<String>,
    pub openspec_count: i64,
    pub feedback_signal_count: i64,
    pub triggered_by_feedback: Option<String>,
    pub scope_check_status: Option<String>,
    pub scope_check_run_at: Option<String>,
    pub scope_out_of_bounds: String, // JSON array
    pub scope_warning_dismissed_at: Option<String>,
    pub scope_warning_dismiss_reason: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct OpenspecChange {
    pub id: String,
    pub idea_id: String,
    pub node_id: String,
    pub title: String,
    pub description: Option<String>,
    pub spec_json: String, // JSON
    pub status: String,
    pub triggered_at: Option<String>,
    pub completed_at: Option<String>,
    pub result_url: Option<String>,
    pub error_message: Option<String>,
    pub executed_by: Option<String>,
    pub reviewed_by: Option<String>,
    pub created_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateEvolutionNodeInput {
    pub idea_id: String,
    pub version: String,
    pub name: String,
    pub description: Option<String>,
    pub status: Option<String>,
    pub node_date: Option<String>,
    pub sort_order: Option<i64>,
}

#[tauri::command]
pub async fn get_evolution_nodes(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Vec<EvolutionNode>, AppError> {
    let nodes = sqlx::query_as::<_, EvolutionNode>(
        "SELECT * FROM evolution_nodes WHERE idea_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(&idea_id)
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(nodes)
}

#[tauri::command]
pub async fn create_evolution_node(
    pool: tauri::State<'_, SqlitePool>,
    data: CreateEvolutionNodeInput,
) -> Result<EvolutionNode, AppError> {
    let id = new_id();
    let now = now_utc();
    let status = data.status.unwrap_or_else(|| "planned".to_string());
    let sort_order = data.sort_order.unwrap_or(0);

    sqlx::query(
        r#"
        INSERT INTO evolution_nodes (
          id, idea_id, version, name, description, status, node_date,
          sort_order, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&data.idea_id)
    .bind(&data.version)
    .bind(&data.name)
    .bind(&data.description)
    .bind(&status)
    .bind(&data.node_date)
    .bind(sort_order)
    .bind(&now)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let node = sqlx::query_as::<_, EvolutionNode>(
        "SELECT * FROM evolution_nodes WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(node)
}

#[tauri::command]
pub async fn get_openspec_changes(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Vec<OpenspecChange>, AppError> {
    let changes = sqlx::query_as::<_, OpenspecChange>(
        "SELECT * FROM openspec_changes WHERE idea_id = ? ORDER BY created_at DESC",
    )
    .bind(&idea_id)
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(changes)
}
