import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import type { Idea, IntentCanvas } from '@maestro/types';
import { Button } from '@/components/ui/button';
import { db, type DialogueMessage } from '@/lib/db';
import { useLLMStream } from '@/hooks/useLLMStream';
import {
  buildIntentFirstRoundMessages,
  buildIntentNextRoundMessages,
  parseIntentRound,
  type IntentQuestion,
  type ChatMessage,
} from '@/lib/llm-prompts';
import { DialogueThread } from '@/components/intent/DialogueThread';
import { A2UIForm } from '@/components/intent/A2UIForm';
import { IntentCanvasPanel } from '@/components/intent/IntentCanvasPanel';
import { ConfirmedAssumptions } from '@/components/intent/ConfirmedAssumptions';
import { Route as IdeasRoute } from '../$id';

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createRoute({
  getParentRoute: () => IdeasRoute,
  path: '/intent',
  component: IntentPage,
});

// ── Component ─────────────────────────────────────────────────────────────────

function IntentPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [idea, setIdea] = useState<Idea | null>(null);
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [canvas, setCanvas] = useState<IntentCanvas | null>(null);
  const [currentQuestions, setCurrentQuestions] = useState<IntentQuestion[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set());
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [assumptions] = useState<string[]>([]);
  const [negatedAssumptions] = useState<string[]>([]);

  // LLM stream for generating questions
  const { text, isStreaming, error: streamError, startStream, reset } = useLLMStream();
  const llmHistoryRef = useRef<ChatMessage[]>([]);
  const hasParsedRef = useRef(false);

  // ── Load initial data ─────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      db.ideas.get(id),
      db.dialogue.list(id),
      db.intent.get(id),
    ]).then(([loadedIdea, loadedMessages, loadedCanvas]) => {
      setIdea(loadedIdea);
      setMessages(loadedMessages);
      setCanvas(loadedCanvas);

      // Determine current round from existing messages
      const maxRound = loadedMessages.reduce((m, msg) => Math.max(m, msg.round), 0);
      const nextRound = maxRound + 1;
      setCurrentRound(nextRound);

      // If we have no messages, start the first round
      if (loadedMessages.length === 0 && loadedIdea.problemStatement) {
        startFirstRound(loadedIdea.problemStatement, loadedIdea.feedRawContent ?? loadedIdea.description ?? '');
      }
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Parse LLM response when stream completes ──────────────────────────────

  useEffect(() => {
    if (isStreaming || !text || hasParsedRef.current) return;
    hasParsedRef.current = true;

    const parsed = parseIntentRound(text);
    if (!parsed) {
      // Fallback: show raw text as an Opus message
      void persistOpusMessage(text, currentRound);
      return;
    }

    const { canvas_update, next_questions, open_questions } = parsed;

    // Persist Opus response as dialogue message, then update canvas + idea state
    void (async () => {
      try {
        await persistOpusMessage(text, currentRound);

        const updatedCanvas = await db.intent.upsert({
          ideaId: id,
          problem: canvas_update.problem,
          rootCause: canvas_update.root_cause,
          mechanism: canvas_update.mechanism,
          targetUser: canvas_update.target_user,
          successMetricDesc: canvas_update.success_metric_desc,
          problemConfidence: canvas_update.problem_confidence,
          rootCauseConfidence: canvas_update.root_cause_confidence,
          mechanismConfidence: canvas_update.mechanism_confidence,
          targetUserConfidence: canvas_update.target_user_confidence,
        });
        setCanvas(updatedCanvas);

        const openCount = open_questions.length;
        const updatedIdea = await db.ideas.update(id, {
          intentClarity: canvas_update.clarity_score,
          intentRounds: currentRound,
          openQuestionsCount: openCount,
        });
        setIdea(updatedIdea);

        setCurrentRound((r) => r + 1);
        setCurrentQuestions(next_questions);

        llmHistoryRef.current = [
          ...llmHistoryRef.current,
          { role: 'assistant', content: text },
        ];
      } catch (err) {
        console.error('[intent] failed to persist round:', err);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, text]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const startFirstRound = useCallback(
    (problemStatement: string, feedContent: string) => {
      hasParsedRef.current = false;
      reset();
      const messages = buildIntentFirstRoundMessages(problemStatement, feedContent);
      llmHistoryRef.current = messages;
      void startStream(messages);
    },
    [reset, startStream],
  );

  const persistOpusMessage = async (content: string, round: number) => {
    const msg = await db.dialogue.add({
      ideaId: id,
      role: 'opus',
      content,
      round,
      modelUsed: 'opus-4',
    });
    setMessages((prev) => [...prev, msg]);
    return msg;
  };

  // ── Submit handler ────────────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (answers: Record<string, string>) => {
      setSubmitting(true);
      hasParsedRef.current = false;
      reset();

      // Build user answer text
      const answerText = currentQuestions
        .map((q) => `${q.label}: ${answers[q.id] ?? '(skipped)'}`)
        .join('\n');

      // Persist user messages
      const userMsg = await db.dialogue.add({
        ideaId: id,
        role: 'user',
        content: answerText,
        round: currentRound,
      });
      setMessages((prev) => [...prev, userMsg]);

      // Build next round messages
      llmHistoryRef.current = buildIntentNextRoundMessages(llmHistoryRef.current, answerText);

      // Start next LLM round
      void startStream(llmHistoryRef.current);
      setSubmitting(false);
    },
    [currentQuestions, currentRound, id, reset, startStream],
  );

  // ── Skip handler ──────────────────────────────────────────────────────────

  const handleSkip = useCallback(() => {
    setConfirmSkip(false);
    hasParsedRef.current = false;
    reset();
    // Advance to next round without user input
    llmHistoryRef.current = [
      ...llmHistoryRef.current,
      { role: 'user', content: '(round skipped by user)' },
    ];
    void startStream(llmHistoryRef.current);
  }, [reset, startStream]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const clarityScore = idea?.intentClarity ?? 0;
  const openQuestionsCount = idea?.openQuestionsCount ?? 0;
  const canProceed = clarityScore >= 85 && openQuestionsCount === 0;

  // Build questions from streaming text (before parsed)
  const displayQuestions = currentQuestions;
  const isWaiting = isStreaming && currentQuestions.length === 0;

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left panel — dialogue + A2UI form */}
      <div className="flex-1 flex flex-col min-h-0 border-r border-border">
        {/* Intent header bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <div>
            <span className="font-mono text-sm font-semibold">intent dialogue</span>
            <span className="ml-2 font-mono text-[10px] text-muted-foreground">
              opus 4 · multi-round · round {currentRound}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory((h) => !h)}
              className="flex items-center gap-1.5 px-3 py-1 rounded border border-border font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            >
              ⊙ history
            </button>
            <Button
              onClick={() => navigate({ to: '/dashboard' })}
              disabled={!canProceed}
              size="sm"
              className="font-mono text-xs"
              title={!canProceed ? `Clarity ${clarityScore}% — needs ≥ 85% and 0 open questions` : 'Proceed to Phase 2 (Boundary Definition)'}
            >
              intent clear · next ↗
            </Button>
          </div>
        </div>

        {/* History panel */}
        {showHistory && (
          <div className="border-b border-border bg-muted/10 px-5 py-3 shrink-0 max-h-48 overflow-auto">
            <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-2">
              Dialogue History
            </p>
            {Array.from(
              new Set(messages.map((m) => m.round)),
            )
              .sort((a, b) => a - b)
              .map((round) => (
                <div key={round} className="mb-2">
                  <button
                    className="font-mono text-xs text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setExpandedRounds((prev) => {
                        const next = new Set(prev);
                        if (next.has(round)) next.delete(round);
                        else next.add(round);
                        return next;
                      })
                    }
                  >
                    {expandedRounds.has(round) ? '▾' : '▸'} round {round}
                  </button>
                  {expandedRounds.has(round) &&
                    messages
                      .filter((m) => m.round === round)
                      .map((msg) => (
                        <div key={msg.id} className="ml-3 mt-1 font-mono text-[10px] text-muted-foreground border-l border-border pl-2">
                          <span className={msg.role === 'opus' ? 'text-amber-500' : ''}>
                            {msg.role === 'opus' ? 'OPUS 4' : 'PM'}
                          </span>
                          {': '}
                          {msg.content.slice(0, 120)}
                          {msg.content.length > 120 ? '…' : ''}
                        </div>
                      ))}
                </div>
              ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto px-5 py-4 flex flex-col gap-4">
          {/* Feed context */}
          {idea?.feedRawContent && (
            <div className="rounded border border-border bg-muted/20 px-4 py-3">
              <p className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground mb-1">
                Original Feed
              </p>
              <p className="font-mono text-xs text-muted-foreground leading-5 line-clamp-3">
                {idea.feedRawContent}
              </p>
            </div>
          )}

          {/* Dialogue thread (past rounds) */}
          <DialogueThread messages={messages} currentRound={currentRound} />

          {/* Streaming indicator */}
          {isWaiting && (
            <div className="font-mono text-xs text-amber-500 animate-pulse">
              ⊙ opus 4 · generating questions…
            </div>
          )}

          {/* Stream error */}
          {streamError && (
            <div className="rounded border border-destructive/40 bg-destructive/5 px-4 py-3">
              <p className="font-mono text-xs text-destructive">{streamError}</p>
              <button
                className="mt-1 font-mono text-xs underline text-muted-foreground"
                onClick={() => void startStream(llmHistoryRef.current)}
              >
                retry
              </button>
            </div>
          )}

          {/* A2UI Form */}
          {displayQuestions.length > 0 && (
            <A2UIForm
              questions={displayQuestions}
              round={currentRound}
              isSubmitting={submitting || isStreaming}
              onSubmit={(answers) => void handleSubmit(answers)}
            />
          )}

          {/* Skip button */}
          {displayQuestions.length > 0 && !submitting && (
            <div className="flex justify-end">
              {confirmSkip ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    skipping reduces clarity · proceed?
                  </span>
                  <button
                    className="font-mono text-xs text-destructive underline"
                    onClick={handleSkip}
                  >
                    yes, skip
                  </button>
                  <button
                    className="font-mono text-xs text-muted-foreground underline"
                    onClick={() => setConfirmSkip(false)}
                  >
                    cancel
                  </button>
                </div>
              ) : (
                <button
                  className="font-mono text-[10px] text-muted-foreground hover:text-foreground underline"
                  onClick={() => setConfirmSkip(true)}
                >
                  skip this round
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — Intent Canvas */}
      <div className="w-[280px] shrink-0 flex flex-col border-l border-border overflow-hidden">
        <IntentCanvasPanel
          canvas={canvas}
          clarityScore={clarityScore}
          openQuestionsCount={openQuestionsCount}
        />
        <ConfirmedAssumptions
          assumptions={assumptions}
          negatedAssumptions={negatedAssumptions}
        />
      </div>
    </div>
  );
}
