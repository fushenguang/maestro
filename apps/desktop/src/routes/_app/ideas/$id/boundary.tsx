import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { Idea, IntentCanvas, ScopeItem } from '@maestro/types';
import { Button } from '@/components/ui/button';
import { db } from '@/lib/db';
import { githubCommitFile } from '@/lib/db';
import { useLLMStream } from '@/hooks/useLLMStream';
import {
  buildScopeAnalysisPrompt,
  parseScopeItems,
} from '@/lib/llm-prompts';
import { ScopeCanvas } from '@/components/boundary/ScopeCanvas';
import { AddItemForm } from '@/components/boundary/AddItemForm';
import { useAuthStore } from '@/store/auth';
import { Route as IdeasRoute } from '../$id';

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createRoute({
  getParentRoute: () => IdeasRoute,
  path: '/boundary',
  component: BoundaryPage,
});

// ── Component ─────────────────────────────────────────────────────────────────

function BoundaryPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);

  const [idea, setIdea] = useState<Idea | null>(null);
  const [canvas, setCanvas] = useState<IntentCanvas | null>(null);
  const [items, setItems] = useState<ScopeItem[]>([]);
  const [locked, setLocked] = useState(false);

  // Modal state
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);
  const [locking, setLocking] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  // LLM stream
  const { text, isStreaming, error: streamError, startStream, reset } = useLLMStream();
  const hasParsedRef = useRef(false);

  // ── Load initial data ─────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      db.ideas.get(id),
      db.intent.get(id),
      db.boundary.list(id),
    ]).then(([loadedIdea, loadedCanvas, loadedItems]) => {
      // Route guard: must have intent clarity ≥ 85
      if ((loadedIdea.intentClarity ?? 0) < 85) {
        void navigate({ to: '/ideas/$id/intent', params: { id } });
        return;
      }

      setIdea(loadedIdea);
      setCanvas(loadedCanvas);
      setItems(loadedItems);
      setLocked(!!loadedIdea.boundaryLockedAt);

      // First visit: no items yet — trigger LLM
      if (loadedItems.length === 0 && loadedCanvas && loadedIdea.problemStatement) {
        triggerLLM(loadedIdea, loadedCanvas);
      }
    }).catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function triggerLLM(loadedIdea: Idea, loadedCanvas: IntentCanvas) {
    hasParsedRef.current = false;
    const messages = buildScopeAnalysisPrompt(
      {
        problem: loadedCanvas.problem ?? '',
        rootCause: loadedCanvas.rootCause ?? '',
        mechanism: loadedCanvas.mechanism ?? '',
        targetUser: loadedCanvas.targetUser ?? '',
      },
      loadedIdea.problemStatement ?? '',
    );
    startStream(messages);
  }

  // ── Parse LLM response when stream completes ──────────────────────────────

  useEffect(() => {
    if (isStreaming || !text || hasParsedRef.current) return;
    hasParsedRef.current = true;

    const parsed = parseScopeItems(text);
    if (!parsed) {
      console.error('[boundary] failed to parse scope items from LLM');
      setReanalyzing(false);
      toast.error('Failed to parse scope analysis. Please re-analyze.');
      return;
    }

    void (async () => {
      try {
        const inserted: ScopeItem[] = [];
        for (let i = 0; i < parsed.scope_items.length; i++) {
          const si = parsed.scope_items[i];
          const saved = await db.boundary.upsert({
            ideaId: id,
            type: si.type,
            title: si.title,
            description: si.description ?? null,
            source: 'opus',
            status: 'needs_confirm',
            sortOrder: i,
          });
          inserted.push(saved);
        }
        setItems(inserted);
        setReanalyzing(false);
      } catch (err) {
        console.error('[boundary] failed to save scope items:', err);
        setReanalyzing(false);
      }
    })();
  }, [isStreaming, text, id]);

  // ── Callbacks ─────────────────────────────────────────────────────────────

  const handleConfirm = useCallback(async (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updated = await db.boundary.upsert({ ...item, status: 'confirmed' });
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
  }, [items]);

  const handleEdit = useCallback(async (itemId: string, title: string, description: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updated = await db.boundary.upsert({ ...item, title, description });
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
  }, [items]);

  const handleMarkType = useCallback(async (itemId: string, type: 'in_scope' | 'out_of_scope') => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    const updated = await db.boundary.upsert({ ...item, type, status: 'confirmed' });
    setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
  }, [items]);

  const handleAdd = useCallback(async (
    type: 'in_scope' | 'out_of_scope' | 'open_question',
    title: string,
    description: string,
  ) => {
    const saved = await db.boundary.upsert({
      ideaId: id,
      type,
      title,
      description,
      source: 'user',
      status: 'needs_confirm',
      sortOrder: items.length,
    });
    setItems((prev) => [...prev, saved]);
  }, [id, items.length]);

  // ── Re-analyze ────────────────────────────────────────────────────────────

  const handleReanalyze = useCallback(async () => {
    if (!idea || !canvas) return;
    setShowReanalyzeModal(false);
    setReanalyzing(true);
    try {
      reset();
      await db.boundary.deleteOpusItems(id);
      setItems((prev) => prev.filter((i) => i.source !== 'opus'));
      triggerLLM(idea, canvas);
    } catch (err) {
      console.error('[boundary] reanalyze failed:', err);
      setReanalyzing(false);
      toast.error('Failed to re-analyze boundary');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea, canvas, id]);

  // ── Lock boundary ─────────────────────────────────────────────────────────

  const canLock = !locked && items.length > 0 &&
    !items.some((i) => i.type === 'open_question' && i.status === 'needs_confirm');

  const handleLock = useCallback(async () => {
    if (!idea) return;
    setShowLockModal(false);
    setLocking(true);
    try {
      await db.boundary.lock(id);

      // Export to GitHub if repo configured
      if (idea.githubRepo) {
        const token = session?.provider_token;
        if (token) {
          const [owner, repo] = idea.githubRepo.split('/');
          const boundaryJson = JSON.stringify(
            {
              idea: idea.name,
              exportedAt: new Date().toISOString(),
              items: items.map((i) => ({
                type: i.type,
                title: i.title,
                description: i.description,
                status: i.status,
              })),
            },
            null,
            2,
          );
          try {
            await githubCommitFile({
              token,
              owner,
              repo,
              path: '.maestro/boundary.json',
              content: boundaryJson,
              message: 'chore: update boundary definition (Maestro)',
            });
          } catch (err) {
            console.warn('[boundary] GitHub export failed:', err);
            toast.warning('Boundary locked, but GitHub export failed.');
          }
        }
      }

      setLocked(true);
      toast.success('Boundary locked');
      void navigate({ to: '/ideas/$id/validation', params: { id } });
    } catch (err) {
      console.error('[boundary] lock failed:', err);
      toast.error('Failed to lock boundary');
    } finally {
      setLocking(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idea, id, items, session]);

  // ── Export as agent context ───────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!idea) return;
    const token = session?.provider_token;
    if (!token || !idea.githubRepo) {
      toast.error('GitHub repo not configured or not authenticated');
      return;
    }
    const [owner, repo] = idea.githubRepo.split('/');
    const content = JSON.stringify(
      {
        idea: idea.name,
        exportedAt: new Date().toISOString(),
        items: items.map((i) => ({
          type: i.type,
          title: i.title,
          description: i.description,
          status: i.status,
        })),
      },
      null,
      2,
    );
    try {
      await githubCommitFile({
        token,
        owner,
        repo,
        path: '.maestro/boundary.json',
        content,
        message: 'chore: export boundary context (Maestro)',
      });
      toast.success('Exported to GitHub');
    } catch (err) {
      console.error('[boundary] export failed:', err);
      toast.error('Export failed');
    }
  }, [idea, items, session]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!idea) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const isGenerating = isStreaming || reanalyzing;

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Boundary Definition</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define what's in scope, out of scope, and open questions.
          </p>
        </div>
        <div className="flex gap-2">
          {!locked && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReanalyzeModal(true)}
              disabled={isGenerating}
            >
              Re-analyze
            </Button>
          )}
          {idea.githubRepo && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExport()}
              disabled={isGenerating || locked === false && items.length === 0}
            >
              Export context
            </Button>
          )}
          {!locked && (
            <Button
              size="sm"
              onClick={() => setShowLockModal(true)}
              disabled={!canLock || isGenerating}
            >
              Lock boundary
            </Button>
          )}
          {locked && (
            <span className="text-xs text-muted-foreground border border-border rounded px-2 py-1">
              Locked
            </span>
          )}
        </div>
      </div>

      {/* Stream error */}
      {streamError && (
        <p className="text-xs text-destructive">LLM error: {streamError}</p>
      )}

      {/* Generating indicator */}
      {isGenerating && (
        <p className="text-xs text-muted-foreground animate-pulse">
          Analyzing scope…
        </p>
      )}

      {/* Canvas */}
      <ScopeCanvas
        items={items}
        locked={locked}
        onConfirm={(itemId) => void handleConfirm(itemId)}
        onEdit={(itemId, title, description) => void handleEdit(itemId, title, description)}
        onMarkType={(itemId, type) => void handleMarkType(itemId, type)}
      />

      {/* Add item form */}
      {!locked && (
        <AddItemForm
          onAdd={(type, title, description) => void handleAdd(type, title, description)}
        />
      )}

      {/* Re-analyze confirmation modal */}
      {showReanalyzeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-semibold">Re-analyze scope?</h3>
            <p className="text-xs text-muted-foreground">
              This will delete all AI-generated items and regenerate them. User-added items will be preserved.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowReanalyzeModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleReanalyze()}>
                Re-analyze
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Lock confirmation modal */}
      {showLockModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-sm w-full space-y-4">
            <h3 className="text-sm font-semibold">Lock boundary definition?</h3>
            <p className="text-xs text-muted-foreground">
              Once locked, the scope cannot be modified. You'll proceed to validation.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowLockModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void handleLock()} disabled={locking}>
                {locking ? 'Locking…' : 'Lock & continue'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
