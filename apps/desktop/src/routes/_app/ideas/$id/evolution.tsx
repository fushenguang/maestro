import { useCallback, useMemo, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { EvolutionNode, Idea, OpenspecChange } from '@maestro/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { db, type ArchDecisionLog } from '@/lib/db';
import { isScopeWarningBlocked } from '@/lib/phase45-utils';
import { Route as IdeasRoute } from '../$id';

export const Route = createRoute({
  getParentRoute: () => IdeasRoute,
  path: '/evolution',
  component: EvolutionPage,
  loader: async ({ params }) => {
    const [idea, nodes, changes, logs] = await Promise.all([
      db.ideas.get(params.id),
      db.evolution.listNodes(params.id),
      db.evolution.listChanges(params.id),
      db.evolution.listArchLogs(params.id),
    ]);

    return { idea, nodes, changes, logs };
  },
});

type GroupedNodes = {
  current: EvolutionNode[];
  planned: EvolutionNode[];
  done: EvolutionNode[];
  archived: EvolutionNode[];
};

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(`${deadline}T00:00:00.000Z`).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

function EvolutionPage() {
  const { id } = Route.useParams();
  const initial = Route.useLoaderData();

  const [idea, setIdea] = useState<Idea>(initial.idea);
  const [nodes, setNodes] = useState<EvolutionNode[]>(initial.nodes);
  const [changes, setChanges] = useState<OpenspecChange[]>(initial.changes);
  const [logs, setLogs] = useState<ArchDecisionLog[]>(initial.logs);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [refreshingMarket, setRefreshingMarket] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const [dismissReasonByNode, setDismissReasonByNode] = useState<Record<string, string>>({});
  const [decisionTextByChange, setDecisionTextByChange] = useState<Record<string, string>>({});

  const grouped = useMemo<GroupedNodes>(() => {
    const sorted = [...nodes].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.createdAt.localeCompare(b.createdAt);
    });

    return {
      current: sorted.filter((n) => n.status === 'current'),
      planned: sorted.filter((n) => n.status === 'planned'),
      done: sorted.filter((n) => n.status === 'done'),
      archived: sorted.filter((n) => n.status === 'archived'),
    };
  }, [nodes]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const handleCreateNode = useCallback(async () => {
    if (!newVersion.trim() || !newName.trim()) {
      toast.error('Version and name are required');
      return;
    }

    setCreating(true);
    try {
      const nextSortOrder = nodes.length === 0 ? 0 : Math.max(...nodes.map((n) => n.sortOrder)) + 1;
      const created = await db.evolution.createNode({
        ideaId: id,
        version: newVersion.trim(),
        name: newName.trim(),
        description: newDescription.trim() || null,
        status: 'planned',
        sortOrder: nextSortOrder,
      });

      setNodes((prev) => [...prev, created]);
      setNewVersion('');
      setNewName('');
      setNewDescription('');
      toast.success('Evolution node created');
    } catch (err) {
      console.error('[evolution] create node failed:', err);
      toast.error('Failed to create node');
    } finally {
      setCreating(false);
    }
  }, [id, newDescription, newName, newVersion, nodes]);

  const handleDismissWarning = useCallback(async (node: EvolutionNode) => {
    const reason = (dismissReasonByNode[node.id] ?? '').trim();
    if (!reason) {
      toast.error('Dismiss reason is required');
      return;
    }

    try {
      const updated = await db.evolution.dismissWarning({
        nodeId: node.id,
        reason,
      });
      setNodes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      toast.success('Scope warning dismissed for this node');
    } catch (err) {
      console.error('[evolution] dismiss warning failed:', err);
      toast.error('Failed to dismiss warning');
    }
  }, [dismissReasonByNode]);

  const handleMarkDoneWithArchLog = useCallback(async (change: OpenspecChange) => {
    const decision = (decisionTextByChange[change.id] ?? '').trim();
    if (!decision) {
      toast.error('At least one architecture decision is required');
      return;
    }

    try {
      const log = await db.evolution.completeWithArchLog({
        openspecId: change.id,
        decisions: [decision],
      });

      setLogs((prev) => [log, ...prev]);
      setChanges((prev) => prev.map((c) => (c.id === change.id ? { ...c, status: 'done' } : c)));
      toast.success('Change marked done after arch log writeback');
    } catch (err) {
      console.error('[evolution] complete with arch log failed:', err);
      toast.error('Failed to mark openspec change done');
    }
  }, [decisionTextByChange]);

  const handleRefreshMarket = useCallback(async () => {
    setRefreshingMarket(true);
    try {
      const result = await db.market.refreshSignal(id);
      const updatedIdea = await db.ideas.get(id);
      setIdea(updatedIdea);
      if (result.currentValue != null) {
        toast.success(`Market refreshed: ${result.currentValue}`);
      } else {
        toast.info(result.message);
      }
    } catch (err) {
      console.error('[evolution] market refresh failed:', err);
      toast.error('Market refresh failed');
    } finally {
      setRefreshingMarket(false);
    }
  }, [id]);

  const sections: Array<{ label: string; nodes: EvolutionNode[] }> = [
    { label: 'Current', nodes: grouped.current },
    { label: 'Planned', nodes: grouped.planned },
    { label: 'Done', nodes: grouped.done },
    { label: 'Archived', nodes: grouped.archived },
  ];

  const deadlineDays = daysUntil(idea.deadline);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Evolution Axis</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Manage versioned milestones and OpenSpec execution under the signed contract.
          </p>
        </div>
        <StatusBadge status={idea.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market Signals</CardTitle>
          <CardDescription>
            last checked: {idea.marketLastCheckedAt ? new Date(idea.marketLastCheckedAt).toLocaleString() : 'never'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 text-sm">
          <span>metric: {idea.successMetric ?? 'n/a'}</span>
          <span>current: {idea.marketCurrentValue}</span>
          <span>target: {idea.targetN ?? 'n/a'}</span>
          <span>days to deadline: {deadlineDays ?? 'n/a'}</span>
          <Button size="sm" variant="outline" onClick={() => void handleRefreshMarket()} disabled={refreshingMarket}>
            {refreshingMarket ? 'Refreshing…' : 'Refresh market'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create Milestone</CardTitle>
          <CardDescription>Create a new evolution node and run scope alignment check.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="version">Version</Label>
            <Input id="version" value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="v0.2.0" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Growth Loop" />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What changes in this milestone?"
            />
          </div>
          <div>
            <Button size="sm" onClick={() => void handleCreateNode()} disabled={creating}>
              {creating ? 'Creating…' : 'Create node'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {sections.map((section) => (
          <Card key={section.label}>
            <CardHeader>
              <CardTitle className="text-base">{section.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.nodes.length === 0 && <p className="text-xs text-muted-foreground">No nodes.</p>}
              {section.nodes.map((node) => {
                const isExpanded = expandedNodeId === node.id;
                const relatedChanges = changes.filter((c) => c.nodeId === node.id);
                const relatedLogs = logs.filter((l) => l.nodeId === node.id);
                const isWarning = isScopeWarningBlocked(node.scopeCheckStatus);
                const warningItems = node.scopeOutOfBounds ?? [];

                return (
                  <div key={node.id} className="rounded border border-border p-3 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{node.version} · {node.name}</p>
                        <p className="text-xs text-muted-foreground">{node.description ?? 'No description'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={node.status} />
                        <StatusBadge status={node.scopeCheckStatus ?? 'pending'} />
                      </div>
                    </div>

                    {isWarning && (
                      <div className="rounded border border-warning/40 bg-warning/10 p-2 text-xs space-y-2">
                        <p>Out-of-scope risks: {warningItems.length ? warningItems.join(', ') : 'detected'}</p>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Dismiss reason (required)"
                            value={dismissReasonByNode[node.id] ?? ''}
                            onChange={(e) =>
                              setDismissReasonByNode((prev) => ({ ...prev, [node.id]: e.target.value }))
                            }
                          />
                          <Button size="sm" variant="outline" onClick={() => void handleDismissWarning(node)}>
                            Dismiss warning
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isWarning}
                        title={isWarning ? 'Scope warning must be resolved first' : 'Trigger OpenSpec'}
                      >
                        Trigger OpenSpec
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedNodeId(isExpanded ? null : node.id)}
                      >
                        {isExpanded ? 'Hide details' : 'Show details'}
                      </Button>
                    </div>

                    {isExpanded && (
                      <div className="pt-2 border-t border-border space-y-3">
                        <div>
                          <p className="text-xs font-medium mb-1">OpenSpec Changes</p>
                          {relatedChanges.length === 0 && <p className="text-xs text-muted-foreground">No changes.</p>}
                          <div className="space-y-2">
                            {relatedChanges.map((change) => (
                              <div key={change.id} className="rounded border border-border px-2 py-2 text-xs space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">{change.title}</span>
                                  <StatusBadge status={change.status} />
                                </div>
                                {change.status !== 'done' && (
                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="Architecture decision summary"
                                      value={decisionTextByChange[change.id] ?? ''}
                                      onChange={(e) =>
                                        setDecisionTextByChange((prev) => ({
                                          ...prev,
                                          [change.id]: e.target.value,
                                        }))
                                      }
                                    />
                                    <Button size="sm" onClick={() => void handleMarkDoneWithArchLog(change)}>
                                      Mark done + log
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-medium mb-1">Arch Decision Logs</p>
                          {relatedLogs.length === 0 && <p className="text-xs text-muted-foreground">No logs.</p>}
                          <div className="space-y-1">
                            {relatedLogs.map((log) => (
                              <div key={log.id} className="rounded border border-border px-2 py-2 text-xs">
                                <p className="font-medium">{new Date(log.writtenAt).toLocaleString()}</p>
                                <p className="text-muted-foreground">{log.decisions.join(' | ') || 'No decisions listed'}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
