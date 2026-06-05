import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { EvidenceItem, Idea, IntentCanvas, ScopeItem, ValidationReport, ValidationVerdict } from '@maestro/types';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { useLLMStream } from '@/hooks/useLLMStream';
import {
  buildAdvocatePrompt,
  buildProsecutorPrompt,
  parseValidationPass,
  type ScopeItemContext,
  type IntentCanvasContext,
} from '@/lib/llm-prompts';
import { AdvocatePanel } from '@/components/validation/AdvocatePanel';
import { ProsecutorPanel } from '@/components/validation/ProsecutorPanel';
import { VerdictBanner } from '@/components/validation/VerdictBanner';
import { Route as IdeasRoute } from '../$id';

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createRoute({
  getParentRoute: () => IdeasRoute,
  path: '/validation',
  component: ValidationPage,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute final verdict from evidence items.
 * - no_go: any fatal_risk evidence, or risk-heavy score
 * - go: sufficiently positive score with manageable risks
 * - pending: otherwise (mixed signals)
 */
function computeVerdict(items: EvidenceItem[]): ValidationVerdict {
  const hasFatal = items.some((i) => i.badge === 'fatal_risk');
  if (hasFatal) return 'no_go';

  const score = items.reduce((acc, i) => {
    switch (i.badge) {
      case 'proves_problem':
        return acc + 2;
      case 'adjacent_signal':
        return acc + 1;
      case 'adoption_risk':
        return acc - 2;
      case 'evidence_gap':
        return acc - 1;
      case 'fatal_risk':
        return acc - 4;
      default:
        return acc;
    }
  }, 0);

  const prosecutorRiskCount = items.filter(
    (i) => i.passType === 'prosecutor' && (i.badge === 'adoption_risk' || i.badge === 'evidence_gap'),
  ).length;

  if (score <= -2 || prosecutorRiskCount >= 4) return 'no_go';
  if (score >= 3 && prosecutorRiskCount <= 2) return 'go';

  return 'pending';
}

type Pass = 'idle' | 'advocate' | 'prosecutor' | 'done';

// ── Component ─────────────────────────────────────────────────────────────────

function ValidationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const [idea, setIdea] = useState<Idea | null>(null);
  const [canvas, setCanvas] = useState<IntentCanvas | null>(null);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const [pass, setPass] = useState<Pass>('idle');
  const [accepting, setAccepting] = useState(false);
  const [showRerunModal, setShowRerunModal] = useState(false);

  // Two separate LLM streams — one per pass
  const advocate = useLLMStream();
  const prosecutor = useLLMStream();

  const hasParsedAdvocateRef = useRef(false);
  const hasParsedProsecutorRef = useRef(false);

  // Keep canvas + scopeItems in refs so effects can access latest without re-running
  const canvasRef = useRef<IntentCanvas | null>(null);
  const scopeItemsRef = useRef<ScopeItem[]>([]);

  const handleRetryFromIdle = useCallback(() => {
    hasParsedAdvocateRef.current = false;
    hasParsedProsecutorRef.current = false;
    advocate.reset();
    prosecutor.reset();
    setPass('advocate');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load initial data ─────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      db.ideas.get(id),
      db.intent.get(id),
      db.boundary.list(id),
      db.validation.getReport(id),
      db.validation.getEvidence(id),
    ]).then(([loadedIdea, loadedCanvas, loadedScope, loadedReport, loadedEvidence]) => {
      // Route guard: boundary must be locked
      if (!loadedIdea.boundaryLockedAt) {
        void navigate({ to: '/ideas/$id/boundary', params: { id } });
        return;
      }

      setIdea(loadedIdea);
      setCanvas(loadedCanvas);
      setScopeItems(loadedScope);
      setReport(loadedReport);
      setEvidence(loadedEvidence);

      canvasRef.current = loadedCanvas;
      scopeItemsRef.current = loadedScope;

      // Determine starting pass
      if (loadedReport?.prosecutorCompletedAt) {
        setPass('done');
      } else if (loadedReport?.advocateCompletedAt) {
        // Advocate done, need to run prosecutor
        setPass('prosecutor');
      } else {
        // Fresh start
        setPass('advocate');
      }
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Trigger advocate stream ───────────────────────────────────────────────

  useEffect(() => {
    if (pass !== 'advocate') return;
    if (!canvasRef.current || scopeItemsRef.current.length === 0) return;

    hasParsedAdvocateRef.current = false;
    advocate.reset();

    const c = canvasRef.current;
    const intentCtx: IntentCanvasContext = {
      problem: c.problem ?? '',
      rootCause: c.rootCause ?? '',
      mechanism: c.mechanism ?? '',
      targetUser: c.targetUser ?? '',
    };
    const scopeCtx: ScopeItemContext[] = scopeItemsRef.current.map((s) => ({
      type: s.type,
      title: s.title,
      description: s.description,
    }));

    void advocate.startStream(buildAdvocatePrompt(intentCtx, scopeCtx));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pass]);

  // ── Parse advocate response ───────────────────────────────────────────────

  useEffect(() => {
    if (advocate.isStreaming || !advocate.text || hasParsedAdvocateRef.current) return;
    if (pass !== 'advocate') return;
    hasParsedAdvocateRef.current = true;

    const parsed = parseValidationPass(advocate.text);
    if (!parsed) {
      console.error('[validation] failed to parse advocate response');
      toast.error('Failed to parse advocate output. Please retry.');
      setPass('idle');
      return;
    }

    void (async () => {
      try {
        // Ensure report exists
        const existingReport = await db.validation.getReport(id);
        const currentReport = existingReport ?? await db.validation.upsertReport({ ideaId: id, verdict: 'pending' });
        setReport(currentReport);

        // Insert advocate evidence items
        const inserted: EvidenceItem[] = [];
        for (let i = 0; i < parsed.evidence_items.length; i++) {
          const ei = parsed.evidence_items[i];
          const saved = await db.validation.addEvidence({
            ideaId: id,
            passType: 'advocate',
            badge: ei.badge,
            title: ei.title,
            description: ei.description,
            sortOrder: i,
          });
          inserted.push(saved);
        }
        setEvidence((prev) => [...prev, ...inserted]);

        // Update report with advocateCompletedAt + synthesis
        const updatedReport = await db.validation.upsertReport({
          ideaId: id,
          advocateGoReasons: parsed.evidence_items.map((e) => e.title),
          advocateCompletedAt: new Date().toISOString(),
          synthesisNotes: parsed.synthesis,
        });
        setReport(updatedReport);

        // Move to prosecutor pass
        setPass('prosecutor');
      } catch (err) {
        console.error('[validation] advocate save failed:', err);
        toast.error('Failed to save advocate analysis. Please retry.');
        setPass('idle');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advocate.isStreaming, advocate.text, pass, id]);

  // ── Trigger prosecutor stream ─────────────────────────────────────────────

  useEffect(() => {
    if (pass !== 'prosecutor') return;
    if (!canvasRef.current || scopeItemsRef.current.length === 0) return;

    hasParsedProsecutorRef.current = false;
    prosecutor.reset();

    const c = canvasRef.current;
    const intentCtx: IntentCanvasContext = {
      problem: c.problem ?? '',
      rootCause: c.rootCause ?? '',
      mechanism: c.mechanism ?? '',
      targetUser: c.targetUser ?? '',
    };
    const scopeCtx: ScopeItemContext[] = scopeItemsRef.current.map((s) => ({
      type: s.type,
      title: s.title,
      description: s.description,
    }));

    void prosecutor.startStream(buildProsecutorPrompt(intentCtx, scopeCtx));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pass]);

  // ── Parse prosecutor response ─────────────────────────────────────────────

  useEffect(() => {
    if (prosecutor.isStreaming || !prosecutor.text || hasParsedProsecutorRef.current) return;
    if (pass !== 'prosecutor') return;
    hasParsedProsecutorRef.current = true;

    const parsed = parseValidationPass(prosecutor.text);
    if (!parsed) {
      console.error('[validation] failed to parse prosecutor response');
      toast.error('Failed to parse prosecutor output. Please retry.');
      setPass('idle');
      return;
    }

    void (async () => {
      try {
        // Insert prosecutor evidence items
        const inserted: EvidenceItem[] = [];
        for (let i = 0; i < parsed.evidence_items.length; i++) {
          const ei = parsed.evidence_items[i];
          const saved = await db.validation.addEvidence({
            ideaId: id,
            passType: 'prosecutor',
            badge: ei.badge,
            title: ei.title,
            description: ei.description,
            sortOrder: i,
          });
          inserted.push(saved);
        }

        // Compute verdict from all evidence
        setEvidence((prev) => {
          const allEvidence = [...prev, ...inserted];
          const verdict = computeVerdict(allEvidence);

          // Update report async (don't block state update)
          void db.validation.upsertReport({
            ideaId: id,
            prosecutorRisks: parsed.evidence_items.map((e) => e.title),
            prosecutorCompletedAt: new Date().toISOString(),
            verdict,
            synthesisNotes: parsed.synthesis,
          }).then((r) => setReport(r));

          return allEvidence;
        });

        setPass('done');
      } catch (err) {
        console.error('[validation] prosecutor save failed:', err);
        toast.error('Failed to save prosecutor analysis. Please retry.');
        setPass('idle');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prosecutor.isStreaming, prosecutor.text, pass, id]);

  // ── Verdict actions ───────────────────────────────────────────────────────

  const handleAccept = useCallback(async () => {
    if (!report?.verdict || !idea) return;
    setAccepting(true);
    try {
      const now = new Date().toISOString();
      await db.ideas.update(id, {
        validationVerdict: report.verdict,
        validationCompletedAt: now,
      });

      if (report.verdict === 'go') {
        toast.success('Validation passed — proceed to contract definition');
        await navigate({ to: '/ideas/$id/contract', params: { id } });
      } else if (report.verdict === 'no_go') {
        toast.warning('Validation returned no-go. Review the findings.');
      } else {
        toast.info('Validation ambiguous — accepted risks noted.');
      }
    } catch (err) {
      console.error('[validation] accept failed:', err);
      toast.error('Failed to save verdict');
    } finally {
      setAccepting(false);
    }
  }, [report, idea, id]);

  // ── Re-run validation ─────────────────────────────────────────────────────

  const handleRerun = useCallback(async () => {
    setShowRerunModal(false);
    advocate.reset();
    prosecutor.reset();
    setEvidence([]);
    setReport(null);
    setPass('idle');

    try {
      await db.validation.deleteEvidence(id);
      await db.validation.deleteReport(id);
    } catch (err) {
      console.error('[validation] rerun cleanup failed:', err);
    }

    setPass('advocate');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!idea) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const advocateCompleted = !!report?.advocateCompletedAt;
  const prosecutorCompleted = !!report?.prosecutorCompletedAt;
  const advocateItems = evidence.filter((e) => e.passType === 'advocate');
  const prosecutorItems = evidence.filter((e) => e.passType === 'prosecutor');

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Validation Gate</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sequential dual-pass analysis — advocate vs prosecutor.
          </p>
        </div>
        <div>
          {pass === 'idle' && (
            <Button variant="outline" size="sm" onClick={handleRetryFromIdle}>
              Retry
            </Button>
          )}
          {pass === 'done' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRerunModal(true)}
            >
              Re-run
            </Button>
          )}
        </div>
      </div>

      {/* Stream errors */}
      {advocate.error && (
        <p className="text-xs text-destructive">Advocate error: {advocate.error}</p>
      )}
      {prosecutor.error && (
        <p className="text-xs text-destructive">Prosecutor error: {prosecutor.error}</p>
      )}

      {/* Dual panels */}
      <div className="flex gap-4">
        <AdvocatePanel
          items={advocateItems}
          isStreaming={pass === 'advocate' && advocate.isStreaming}
          completed={advocateCompleted}
        />
        <ProsecutorPanel
          items={prosecutorItems}
          isStreaming={pass === 'prosecutor' && prosecutor.isStreaming}
          completed={prosecutorCompleted}
        />
      </div>

      {/* Verdict banner */}
      {pass === 'done' && report?.verdict && (
        <VerdictBanner
          verdict={report.verdict}
          synthesis={report.synthesisNotes}
          onAccept={() => void handleAccept()}
          onRerun={() => setShowRerunModal(true)}
          accepting={accepting}
        />
      )}

      {/* Re-run confirmation modal */}
      {showRerunModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-semibold">Re-run validation?</h3>
            <p className="text-xs text-muted-foreground">
              This will delete all existing evidence and re-run both passes. This takes 30-40 seconds.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowRerunModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleRerun()}>
                Re-run
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
