use tauri::Manager;

use crate::error::AppError;
use crate::llm::{config as llm_config, provider::ChatPayload, streaming};

/// Start a streaming LLM chat. Chunks are pushed as Tauri events:
///   - `llm-stream-{event_id}` — text delta
///   - `llm-stream-{event_id}-done` — full assembled text
///   - `llm-stream-{event_id}-error` — error string
///
/// Returns immediately; streaming runs in a spawned task.
#[tauri::command]
pub async fn llm_chat_stream(
    app: tauri::AppHandle,
    payload: ChatPayload,
    event_id: String,
) -> Result<(), AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::LlmError(e.to_string()))?;

    let config = llm_config::load(&data_dir);

    // Spawn background task — returns immediately to the frontend
    // api_key emptiness is checked inside streaming::stream_chat which emits the error event
    tokio::spawn(async move {
        streaming::stream_chat(app, config, payload.messages, event_id).await;
    });

    Ok(())
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfigPublic {
    pub base_url: String,
    pub model: String,
    pub has_api_key: bool,
}

/// Save LLM provider configuration (api_key, base_url, model).
#[tauri::command]
pub async fn llm_set_config(
    app: tauri::AppHandle,
    api_key: String,
    base_url: String,
    model: String,
) -> Result<(), AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::LlmError(e.to_string()))?;

    let config = llm_config::LlmConfig { api_key, base_url, model };
    llm_config::save(&data_dir, &config).map_err(AppError::LlmError)
}

/// Return non-secret LLM config for display in Settings.
#[tauri::command]
pub async fn llm_get_config(app: tauri::AppHandle) -> Result<LlmConfigPublic, AppError> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::LlmError(e.to_string()))?;

    let config = llm_config::load(&data_dir);
    Ok(LlmConfigPublic {
        base_url: config.base_url,
        model: config.model,
        has_api_key: !config.api_key.is_empty(),
    })
}
