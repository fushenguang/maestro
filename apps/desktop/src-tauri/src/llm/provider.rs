use serde::{Deserialize, Serialize};

/// A single message in a chat conversation.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Payload for a streaming chat request.
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatPayload {
    pub messages: Vec<ChatMessage>,
}

// ── OpenAI-compatible SSE response structures ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct SseChunk {
    pub choices: Vec<SseChoice>,
}

#[derive(Debug, Deserialize)]
pub struct SseChoice {
    pub delta: SseDelta,
    pub finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SseDelta {
    pub content: Option<String>,
}
