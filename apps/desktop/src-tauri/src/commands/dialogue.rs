use sqlx::SqlitePool;

use crate::error::AppError;
use super::profiles::{new_id, now_utc};

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct DialogueMessage {
    pub id: String,
    pub idea_id: String,
    pub role: String,
    pub content: String,
    pub round: i64,
    pub tokens_used: Option<i64>,
    pub model_used: Option<String>,
    pub created_at: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddDialogueMessageInput {
    pub idea_id: String,
    pub role: String,
    pub content: String,
    pub round: i64,
    pub tokens_used: Option<i64>,
    pub model_used: Option<String>,
}

#[tauri::command]
pub async fn get_dialogue_messages(
    pool: tauri::State<'_, SqlitePool>,
    idea_id: String,
) -> Result<Vec<DialogueMessage>, AppError> {
    let messages = sqlx::query_as::<_, DialogueMessage>(
        "SELECT * FROM dialogue_messages WHERE idea_id = ? ORDER BY round ASC, created_at ASC",
    )
    .bind(&idea_id)
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(messages)
}

#[tauri::command]
pub async fn add_dialogue_message(
    pool: tauri::State<'_, SqlitePool>,
    data: AddDialogueMessageInput,
) -> Result<DialogueMessage, AppError> {
    let id = new_id();
    let now = now_utc();

    sqlx::query(
        r#"
        INSERT INTO dialogue_messages (id, idea_id, role, content, round, tokens_used, model_used, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&data.idea_id)
    .bind(&data.role)
    .bind(&data.content)
    .bind(data.round)
    .bind(data.tokens_used)
    .bind(&data.model_used)
    .bind(&now)
    .execute(pool.inner())
    .await
    .map_err(AppError::from)?;

    let message = sqlx::query_as::<_, DialogueMessage>(
        "SELECT * FROM dialogue_messages WHERE id = ?",
    )
    .bind(&id)
    .fetch_one(pool.inner())
    .await
    .map_err(AppError::from)?;

    Ok(message)
}
