use sqlx::SqlitePool;

use crate::error::AppError;
use super::profiles::{new_id, now_utc};

fn collect_keyword_hits(source: &str, candidates: &[String]) -> Vec<String> {
    let hay = source.to_lowercase();
    candidates
        .iter()
        .filter(|item| {
            item.split_whitespace()
                .filter(|w| w.len() >= 3)
                .any(|w| hay.contains(&w.to_lowercase()))
        })
        .cloned()
        .collect()
}

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

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ArchDecisionLog {
    pub id: String,
    pub openspec_id: String,
    pub idea_id: String,
    pub node_id: String,
    pub decisions: String,
    pub deps_added: String,
    pub deps_removed: String,
    pub files_changed: String,
    pub agent_notes: Option<String>,
    pub exported_to_context_at: Option<String>,
    pub context_commit_sha: Option<String>,
    pub model_used: String,
    pub written_at: String,
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

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DismissScopeWarningInput {
    pub node_id: String,
    pub reason: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteOpenspecChangeInput {
    pub openspec_id: String,
    pub decisions: Vec<String>,
    pub deps_added: Vec<String>,
    pub deps_removed: Vec<String>,
    pub files_changed: Vec<String>,
    pub agent_notes: Option<String>,
    pub model_used: Option<String>,
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

        let description = data.description.clone().unwrap_or_default();
        let out_of_scope_titles: Vec<String> = sqlx::query_scalar(
                "SELECT title FROM scope_items WHERE idea_id = ? AND type = 'out_of_scope' AND status = 'confirmed'",
        )
        .bind(&data.idea_id)
        .fetch_all(pool.inner())
        .await
        .map_err(AppError::from)?;

        let hits = collect_keyword_hits(&description, &out_of_scope_titles);
        let scope_check_status = if hits.is_empty() { "clean" } else { "warning" };
        let out_of_bounds_json = serde_json::to_string(&hits).unwrap_or_else(|_| "[]".to_string());

        sqlx::query(
        r#"
        INSERT INTO evolution_nodes (
          id, idea_id, version, name, description, status, node_date,
                    scope_check_status, scope_check_run_at, scope_out_of_bounds,
                    sort_order, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&data.idea_id)
    .bind(&data.version)
    .bind(&data.name)
    .bind(&data.description)
    .bind(&status)
    .bind(&data.node_date)
    .bind(scope_check_status)
    .bind(&now)
    .bind(&out_of_bounds_json)
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

#[tauri::command]
pub async fn get_arch_decision_logs(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Vec<ArchDecisionLog>, AppError> {
    let logs = sqlx::query_as::<_, ArchDecisionLog>(
        "SELECT * FROM arch_decision_logs WHERE idea_id = ? ORDER BY written_at DESC",
    )
    .bind(&idea_id)
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(logs)
}

#[tauri::command]
pub async fn dismiss_scope_warning(
    pool: tauri::State<'_, SqlitePool>,
    data: DismissScopeWarningInput,
) -> Result<EvolutionNode, AppError> {
    let reason = data.reason.trim();
    if reason.is_empty() {
        return Err(AppError::ValidationError(
            "Dismissal reason is required".to_string(),
        ));
    }

    let now = now_utc();
    sqlx::query(
        r#"
        UPDATE evolution_nodes
        SET scope_check_status = 'dismissed',
            scope_warning_dismissed_at = ?,
            scope_warning_dismiss_reason = ?,
            updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&now)
    .bind(reason)
    .bind(&now)
    .bind(&data.node_id)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let node = sqlx::query_as::<_, EvolutionNode>("SELECT * FROM evolution_nodes WHERE id = ?")
        .bind(&data.node_id)
        .fetch_one(pool.inner())
        .await
        .map_err(AppError::from)?;

    Ok(node)
}

#[tauri::command]
pub async fn complete_openspec_change_with_arch_log(
    pool: tauri::State<'_, SqlitePool>,
    data: CompleteOpenspecChangeInput,
) -> Result<ArchDecisionLog, AppError> {
    if data.decisions.is_empty() {
        return Err(AppError::ValidationError(
            "At least one architecture decision is required before marking done".to_string(),
        ));
    }

    let change = sqlx::query_as::<_, OpenspecChange>(
        "SELECT * FROM openspec_changes WHERE id = ?",
    )
    .bind(&data.openspec_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(AppError::from)?
    .ok_or_else(|| AppError::NotFound(data.openspec_id.clone()))?;

    let log_id = new_id();
    let now = now_utc();
    let decisions = serde_json::to_string(&data.decisions).unwrap_or_else(|_| "[]".to_string());
    let deps_added = serde_json::to_string(&data.deps_added).unwrap_or_else(|_| "[]".to_string());
    let deps_removed = serde_json::to_string(&data.deps_removed).unwrap_or_else(|_| "[]".to_string());
    let files_changed = serde_json::to_string(&data.files_changed).unwrap_or_else(|_| "[]".to_string());
    let model_used = data.model_used.unwrap_or_else(|| "codex".to_string());

    sqlx::query(
        r#"
        INSERT INTO arch_decision_logs (
          id, openspec_id, idea_id, node_id,
          decisions, deps_added, deps_removed, files_changed,
          agent_notes, model_used, written_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(openspec_id) DO UPDATE SET
          decisions = excluded.decisions,
          deps_added = excluded.deps_added,
          deps_removed = excluded.deps_removed,
          files_changed = excluded.files_changed,
          agent_notes = excluded.agent_notes,
          model_used = excluded.model_used,
          written_at = excluded.written_at
        "#,
    )
    .bind(&log_id)
    .bind(&change.id)
    .bind(&change.idea_id)
    .bind(&change.node_id)
    .bind(&decisions)
    .bind(&deps_added)
    .bind(&deps_removed)
    .bind(&files_changed)
    .bind(&data.agent_notes)
    .bind(&model_used)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    sqlx::query(
        r#"
        UPDATE openspec_changes
        SET status = 'done',
            completed_at = ?,
            error_message = NULL
        WHERE id = ?
        "#,
    )
    .bind(&now)
    .bind(&change.id)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let log = sqlx::query_as::<_, ArchDecisionLog>(
        "SELECT * FROM arch_decision_logs WHERE openspec_id = ?",
    )
    .bind(&change.id)
    .fetch_one(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(log)
}
