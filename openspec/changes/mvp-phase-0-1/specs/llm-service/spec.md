## ADDED Requirements

### Requirement: LLM provider is configurable via secure store
The system SHALL read `llm_api_key` and `llm_base_url` from the Tauri secure store. If not configured, LLM commands SHALL return a descriptive error directing the user to configure settings.

#### Scenario: Config missing
- **WHEN** a Tauri LLM command is invoked and `llm_api_key` is not set in the secure store
- **THEN** the command SHALL return an error: "LLM API key not configured. Please set it in Settings."

#### Scenario: Config present
- **WHEN** `llm_api_key` and `llm_base_url` are set
- **THEN** the LLM command SHALL proceed with the configured provider

### Requirement: LLM streaming delivers chunks via Tauri events
The system SHALL stream LLM response chunks to the frontend via `window.emit` using event name `llm-stream-{event_id}`. Completion SHALL emit `llm-stream-{event_id}-done`. Errors SHALL emit `llm-stream-{event_id}-error`.

#### Scenario: Streaming chunk received on frontend
- **WHEN** the LLM provider returns a streaming SSE delta
- **THEN** the Tauri backend SHALL emit a `llm-stream-{event_id}` event with the text chunk to the frontend window

#### Scenario: Stream completes
- **WHEN** the LLM stream ends (finish_reason: stop)
- **THEN** the backend SHALL emit `llm-stream-{event_id}-done` with the complete assembled text

#### Scenario: Stream errors
- **WHEN** the LLM API returns an error during streaming
- **THEN** the backend SHALL emit `llm-stream-{event_id}-error` with the error message

### Requirement: Frontend useLLMStream hook manages streaming state
The system SHALL provide a `useLLMStream` React hook that invokes the Tauri command, subscribes to the stream events, and exposes `{ text, isStreaming, error }`.

#### Scenario: Hook provides live text
- **WHEN** streaming is in progress
- **THEN** `useLLMStream` SHALL expose accumulated `text` that updates with each chunk, and `isStreaming` SHALL be true

#### Scenario: Hook cleans up on unmount
- **WHEN** the component using `useLLMStream` unmounts
- **THEN** the hook SHALL unlisten from all Tauri events for that `event_id`
