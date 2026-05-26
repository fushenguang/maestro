use tauri::Emitter;

use crate::llm::config::LlmConfig;
use crate::llm::provider::{ChatMessage, SseChunk};

/// Stream a chat completion from an OpenAI-compatible endpoint.
///
/// Chunks are emitted as Tauri events:
///   - `llm-stream-{event_id}` — text delta (String)
///   - `llm-stream-{event_id}-done` — full assembled text (String)
///   - `llm-stream-{event_id}-error` — error message (String)
pub async fn stream_chat(
    app: tauri::AppHandle,
    config: LlmConfig,
    messages: Vec<ChatMessage>,
    event_id: String,
) {
    let result = do_stream(app.clone(), &config, messages, &event_id).await;
    if let Err(err) = result {
        let _ = app.emit(&format!("llm-stream-{event_id}-error"), err);
    }
}

async fn do_stream(
    app: tauri::AppHandle,
    config: &LlmConfig,
    messages: Vec<ChatMessage>,
    event_id: &str,
) -> Result<(), String> {
    if config.api_key.is_empty() {
        return Err("LLM API key not configured. Please set it in Settings.".to_string());
    }

    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", config.base_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "stream": true,
    });

    let response = client
        .post(&url)
        .bearer_auth(&config.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("LLM API error {status}: {text}"));
    }

    let mut buffer = Vec::<u8>::new();
    let mut full_text = String::new();
    let mut response = response;

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Stream read error: {e}"))?
    {
        buffer.extend_from_slice(&chunk);

        // Process complete lines (newline-delimited SSE)
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = buffer.drain(..=pos).collect();
            let line = std::str::from_utf8(&line_bytes)
                .unwrap_or("")
                .trim()
                .to_string();

            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    let _ = app.emit(&format!("llm-stream-{event_id}-done"), &full_text);
                    return Ok(());
                }
                if let Ok(sse) = serde_json::from_str::<SseChunk>(data) {
                    if let Some(delta) = sse
                        .choices
                        .first()
                        .and_then(|c| c.delta.content.as_deref())
                    {
                        full_text.push_str(delta);
                        let _ = app.emit(&format!("llm-stream-{event_id}"), delta);
                    }
                }
            }
        }
    }

    // Stream ended without [DONE] — still emit done with what we have
    let _ = app.emit(&format!("llm-stream-{event_id}-done"), &full_text);
    Ok(())
}
