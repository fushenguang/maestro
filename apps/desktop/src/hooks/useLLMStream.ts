/**
 * useLLMStream — React hook that subscribes to a Tauri LLM stream.
 *
 * Usage:
 *   const { text, isStreaming, error, startStream, reset } = useLLMStream();
 *   await startStream(messages);
 */
import { useCallback, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { callLLMStream, newEventId, type ChatMessage } from '@/lib/llm';

interface UseLLMStreamResult {
  text: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (messages: ChatMessage[]) => Promise<void>;
  reset: () => void;
}

export function useLLMStream(): UseLLMStreamResult {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hold unlistener refs so we can clean up on unmount or reset
  const unlisteners = useRef<Array<() => void>>([]);

  const reset = useCallback(() => {
    setText('');
    setError(null);
    setIsStreaming(false);
    unlisteners.current.forEach((fn) => fn());
    unlisteners.current = [];
  }, []);

  const startStream = useCallback(async (messages: ChatMessage[]) => {
    // Clean up any previous listeners
    unlisteners.current.forEach((fn) => fn());
    unlisteners.current = [];
    setText('');
    setError(null);
    setIsStreaming(true);

    const eventId = newEventId();

    // Subscribe before invoking so we don't miss early chunks
    const [chunkUn, doneUn, errorUn] = await Promise.all([
      listen<string>(`llm-stream-${eventId}`, (e) => {
        setText((prev) => prev + e.payload);
      }),
      listen<string>(`llm-stream-${eventId}-done`, (e) => {
        setText(e.payload);
        setIsStreaming(false);
      }),
      listen<string>(`llm-stream-${eventId}-error`, (e) => {
        setError(e.payload);
        setIsStreaming(false);
      }),
    ]);

    unlisteners.current = [chunkUn, doneUn, errorUn];

    try {
      await callLLMStream(messages, eventId);
    } catch (err) {
      setError(String(err));
      setIsStreaming(false);
    }
  }, []);

  return { text, isStreaming, error, startStream, reset };
}
