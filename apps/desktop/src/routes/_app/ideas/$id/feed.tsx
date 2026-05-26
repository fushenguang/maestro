import { useEffect, useRef, useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { useLLMStream } from '@/hooks/useLLMStream';
import {
  buildFeedAnalysisMessages,
  parseFeedAnalysis,
} from '@/lib/llm-prompts';
import type { Idea } from '@maestro/types';
import { Route as IdeasRoute } from '../$id';

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createRoute({
  getParentRoute: () => IdeasRoute,
  path: '/feed',
  component: FeedPage,
});

// ── Component ─────────────────────────────────────────────────────────────────

function FeedPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [idea, setIdea] = useState<Idea | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const { text, isStreaming, error: streamError, startStream } = useLLMStream();
  const hasSavedRef = useRef(false);

  useEffect(() => {
    db.ideas.get(id).then(setIdea).catch(console.error);
  }, [id]);

  // Auto-start analysis when idea loads and hasn't been analysed yet
  useEffect(() => {
    if (!idea || analysisStarted) return;
    if (idea.problemStatement) {
      // Already analysed — nothing to do
      setAnalysisStarted(true);
      return;
    }
    const feedContent = idea.feedRawContent ?? idea.description ?? '';
    if (!feedContent.trim()) return;

    setAnalysisStarted(true);
    const messages = buildFeedAnalysisMessages(feedContent);
    void startStream(messages);
  }, [idea, analysisStarted, startStream]);

  // When streaming finishes, parse and persist the problem statement
  useEffect(() => {
    if (isStreaming || !text || hasSavedRef.current) return;
    hasSavedRef.current = true;

    const result = parseFeedAnalysis(text);
    const statement = result?.problem_statement ?? text.slice(0, 500);

    db.ideas
      .update(id, {
        problemStatement: statement,
        feedCompletedAt: new Date().toISOString(),
        currentPhase: 1,
      })
      .then((updated) => setIdea(updated))
      .catch((err: unknown) => setAnalysisError(String(err)));
  }, [isStreaming, text, id]);

  const canProceed = Boolean(idea?.problemStatement || (text && !isStreaming));
  const problemStatement = idea?.problemStatement ?? (text && !isStreaming ? text : null);

  return (
    <div className="flex flex-col gap-6 p-8 max-w-2xl">
      {/* Header */}
      <div>
        <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1">
          Phase 0 — Feed
        </p>
        <h1 className="font-mono text-lg font-semibold">{idea?.name ?? '…'}</h1>
      </div>

      {/* Raw feed preview */}
      {idea?.feedRawContent && (
        <div className="rounded border border-border bg-muted/20 px-4 py-3">
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
            Original Feed
          </p>
          <p className="font-mono text-xs text-muted-foreground leading-5 whitespace-pre-wrap line-clamp-4">
            {idea.feedRawContent}
          </p>
        </div>
      )}

      {/* Analysis progress / result */}
      <div className="rounded border border-border px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            Problem Statement
          </p>
          {isStreaming && (
            <span className="font-mono text-[10px] text-amber-500 animate-pulse">
              opus 4 · analysing…
            </span>
          )}
        </div>

        {isStreaming && (
          <p className="font-mono text-xs text-muted-foreground leading-5">
            {text || 'reading your idea…'}
          </p>
        )}

        {!isStreaming && problemStatement && (
          <p className="font-mono text-sm leading-6">{problemStatement}</p>
        )}

        {!isStreaming && !problemStatement && !analysisStarted && (
          <p className="font-mono text-xs text-muted-foreground">Starting analysis…</p>
        )}
      </div>

      {/* Errors */}
      {(streamError || analysisError) && (
        <div className="rounded border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="font-mono text-xs text-destructive">
            {streamError ?? analysisError}
          </p>
          <button
            className="mt-2 font-mono text-xs text-muted-foreground underline"
            onClick={() => {
              hasSavedRef.current = false;
              const feedContent = idea?.feedRawContent ?? idea?.description ?? '';
              void startStream(buildFeedAnalysisMessages(feedContent));
            }}
          >
            retry
          </button>
        </div>
      )}

      {/* Proceed CTA */}
      <div className="flex items-center gap-3 mt-2">
        <Button
          onClick={() => navigate({ to: '/ideas/$id/intent', params: { id } })}
          disabled={!canProceed || isStreaming}
          className="font-sans text-sm font-semibold"
        >
          proceed to intent dialogue ↗
        </Button>
        {!canProceed && !isStreaming && (
          <span className="font-mono text-xs text-muted-foreground">
            waiting for analysis…
          </span>
        )}
      </div>
    </div>
  );
}
