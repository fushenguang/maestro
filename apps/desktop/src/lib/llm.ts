/**
 * llm.ts — Frontend wrapper for Tauri LLM commands.
 */
import { invoke } from '@tauri-apps/api/core';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LlmConfigPublic {
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
}

/**
 * Trigger a streaming LLM chat. Chunks are delivered via Tauri events
 * `llm-stream-{eventId}`, `llm-stream-{eventId}-done`, `llm-stream-{eventId}-error`.
 * Returns immediately — subscribe to events via `useLLMStream`.
 */
export async function callLLMStream(
  messages: ChatMessage[],
  eventId: string,
): Promise<void> {
  await invoke<void>('llm_chat_stream', {
    payload: { messages },
    eventId,
  });
}

export async function getLlmConfig(): Promise<LlmConfigPublic> {
  return invoke<LlmConfigPublic>('llm_get_config');
}

export async function setLlmConfig(
  apiKey: string,
  baseUrl: string,
  model: string,
): Promise<void> {
  return invoke<void>('llm_set_config', { apiKey, baseUrl, model });
}

/** Generate a unique event ID for a streaming call. */
export function newEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
