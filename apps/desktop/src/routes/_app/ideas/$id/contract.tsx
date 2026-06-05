import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoute, useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import type { Contract, Idea, ProductType, SuccessMetric } from '@maestro/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { db } from '@/lib/db';
import { buildContractChecklist, canSignContract } from '@/lib/phase45-utils';
import { useAuthStore } from '@/store/auth';
import { Route as IdeasRoute } from '../$id';

export const Route = createRoute({
  getParentRoute: () => IdeasRoute,
  path: '/contract',
  component: ContractPage,
});

type ContractForm = {
  productType: ProductType;
  deadline: string;
  successMetric: SuccessMetric;
  targetN: number;
  githubRepo: string;
};

const DEFAULT_FORM: ContractForm = {
  productType: 'opensource',
  deadline: '',
  successMetric: 'github_stars',
  targetN: 100,
  githubRepo: '',
};

function parseError(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const maybe = err as { message?: string; type?: string };
    if (maybe.type === 'ContractImmutable') {
      return 'Contract already signed and immutable.';
    }
    if (maybe.type === 'RepoVerifyFailed') {
      return maybe.message ?? 'Repository verification failed.';
    }
    if (maybe.message) return maybe.message;
  }

  return 'Unexpected error';
}

function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace('https://github.com/', '').replace(/\/$/, '');
  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length !== 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

function ContractPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);

  const [idea, setIdea] = useState<Idea | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [form, setForm] = useState<ContractForm>(DEFAULT_FORM);
  const [repoVerified, setRepoVerified] = useState(false);

  const [confirmBoundary, setConfirmBoundary] = useState(false);
  const [confirmIrreversible, setConfirmIrreversible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [verifyingRepo, setVerifyingRepo] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [stepOneChecked, setStepOneChecked] = useState(false);
  const [secondReady, setSecondReady] = useState(false);

  const [exportRetryMessage, setExportRetryMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedIdea, loadedContract] = await Promise.all([
        db.ideas.get(id),
        db.contracts.get(id),
      ]);

      if (loadedIdea.validationVerdict !== 'go') {
        void navigate({ to: '/ideas/$id/validation', params: { id } });
        return;
      }

      setIdea(loadedIdea);
      setContract(loadedContract);

      if (loadedContract) {
        setForm({
          productType: loadedContract.productType,
          deadline: loadedContract.deadline,
          successMetric: loadedContract.successMetric,
          targetN: loadedContract.targetN,
          githubRepo: loadedContract.githubRepo,
        });
        setRepoVerified(true);
      } else {
        setForm({
          ...DEFAULT_FORM,
          githubRepo: loadedIdea.githubRepo ?? '',
          productType: (loadedIdea.productType as ProductType | null) ?? DEFAULT_FORM.productType,
          deadline: loadedIdea.deadline ?? DEFAULT_FORM.deadline,
          successMetric: (loadedIdea.successMetric as SuccessMetric | null) ?? DEFAULT_FORM.successMetric,
          targetN: loadedIdea.targetN ?? DEFAULT_FORM.targetN,
        });
      }
    } catch (err) {
      console.error('[contract] load failed:', err);
      toast.error('Failed to load contract data');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showSignModal || !stepOneChecked) {
      setSecondReady(false);
      return;
    }

    const timer = window.setTimeout(() => setSecondReady(true), 1400);
    return () => window.clearTimeout(timer);
  }, [showSignModal, stepOneChecked]);

  const signed = Boolean(contract?.signedAt);

  const checklist = useMemo(() => {
    return buildContractChecklist(idea, repoVerified, confirmBoundary, confirmIrreversible);
  }, [idea?.boundaryLockedAt, idea?.validationVerdict, repoVerified, confirmBoundary, confirmIrreversible]);

  const canSign = useMemo(() => {
    return canSignContract(signed, checklist, {
      deadline: form.deadline,
      githubRepo: form.githubRepo,
      targetN: form.targetN,
    });
  }, [checklist, signed, form.deadline, form.githubRepo, form.targetN]);

  const handleRepoVerify = useCallback(async () => {
    if (!form.githubRepo.trim()) {
      toast.error('Please enter a GitHub repository first');
      return;
    }

    setVerifyingRepo(true);
    try {
      const result = await db.market.verifyRepo(form.githubRepo);
      if (result.ok) {
        setRepoVerified(true);
        toast.success('Repository verified');
      } else {
        setRepoVerified(false);
        toast.error(result.message);
      }
    } catch (err) {
      setRepoVerified(false);
      toast.error(parseError(err));
    } finally {
      setVerifyingRepo(false);
    }
  }, [form.githubRepo]);

  const tryExportArtifact = useCallback(
    async (signedContract: Contract) => {
      const providerToken = (session as unknown as { provider_token?: string; access_token?: string } | null)?.provider_token
        ?? (session as unknown as { provider_token?: string; access_token?: string } | null)?.access_token;

      const parsedRepo = parseOwnerRepo(signedContract.githubRepo);
      if (!providerToken || !parsedRepo) {
        setExportRetryMessage('Contract signed locally. Could not export to .maestro/contract.json automatically.');
        return;
      }

      try {
        await db.contracts.exportArtifact({
          token: providerToken,
          ideaId: signedContract.ideaId,
          owner: parsedRepo.owner,
          repo: parsedRepo.repo,
        });
        setExportRetryMessage(null);
        toast.success('Contract exported to .maestro/contract.json');
      } catch (err) {
        setExportRetryMessage(parseError(err));
        toast.warning('Contract signed, but export failed. Retry is available.');
      }
    },
    [session],
  );

  const handleSign = useCallback(async () => {
    if (!canSign || signing) return;

    setSigning(true);
    try {
      const signedContract = await db.contracts.sign(id, {
        productType: form.productType,
        deadline: form.deadline,
        successMetric: form.successMetric,
        targetN: Number(form.targetN),
        githubRepo: form.githubRepo,
      });

      setContract(signedContract);
      setShowSignModal(false);
      setStepOneChecked(false);
      setSecondReady(false);

      await tryExportArtifact(signedContract);
      toast.success(`Contract signed: ${signedContract.contractRef}`);
    } catch (err) {
      toast.error(parseError(err));
    } finally {
      setSigning(false);
    }
  }, [canSign, form.deadline, form.githubRepo, form.productType, form.successMetric, form.targetN, id, signing, tryExportArtifact]);

  if (loading || !idea) {
    return <div className="p-6 text-sm text-muted-foreground">Loading contract…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Product Contract</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Lock your launch commitment. After signing, contract fields become immutable.
          </p>
        </div>
        <StatusBadge status={signed ? 'done' : 'draft'} />
      </div>

      {exportRetryMessage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Export Retry Needed</CardTitle>
            <CardDescription>{exportRetryMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              onClick={() => {
                if (!contract) return;
                void tryExportArtifact(contract);
              }}
              disabled={!contract}
            >
              Retry export
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contract Terms</CardTitle>
          {signed && contract && (
            <CardDescription>
              {contract.contractRef} · signed at {new Date(contract.signedAt ?? '').toLocaleString()}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="productType">Product Type</Label>
              <select
                id="productType"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.productType}
                disabled={signed}
                onChange={(e) => setForm((prev) => ({ ...prev, productType: e.target.value as ProductType }))}
              >
                <option value="paid">paid</option>
                <option value="opensource">opensource</option>
                <option value="internal">internal</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deadline">Deadline</Label>
              <Input
                id="deadline"
                type="date"
                value={form.deadline}
                disabled={signed}
                onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="successMetric">Success Metric</Label>
              <select
                id="successMetric"
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={form.successMetric}
                disabled={signed}
                onChange={(e) => setForm((prev) => ({ ...prev, successMetric: e.target.value as SuccessMetric }))}
              >
                <option value="paid_users">paid_users</option>
                <option value="github_stars">github_stars</option>
                <option value="weekly_downloads">weekly_downloads</option>
                <option value="url_reachable">url_reachable</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="targetN">Target N</Label>
              <Input
                id="targetN"
                type="number"
                min={1}
                value={String(form.targetN)}
                disabled={signed}
                onChange={(e) => setForm((prev) => ({ ...prev, targetN: Number(e.target.value || 0) }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="githubRepo">GitHub Repo</Label>
            <div className="flex gap-2">
              <Input
                id="githubRepo"
                placeholder="owner/repo"
                value={form.githubRepo}
                disabled={signed}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, githubRepo: e.target.value }));
                  setRepoVerified(false);
                }}
              />
              {!signed && (
                <Button variant="outline" size="sm" onClick={() => void handleRepoVerify()} disabled={verifyingRepo}>
                  {verifyingRepo ? 'Verifying…' : 'Verify'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {!signed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pre-Sign Checklist</CardTitle>
            <CardDescription>All items must be complete before signing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ChecklistItem label="Boundary is locked" checked={checklist.boundaryLocked} />
            <ChecklistItem label="Validation verdict is GO" checked={checklist.validationGo} />
            <ChecklistItem label="GitHub repo has been verified" checked={checklist.repoVerified} />
            <CheckboxLine
              label="I confirm this boundary should remain frozen unless a new evolution node is created"
              checked={confirmBoundary}
              onChange={setConfirmBoundary}
            />
            <CheckboxLine
              label="I acknowledge this signing action is irreversible"
              checked={confirmIrreversible}
              onChange={setConfirmIrreversible}
            />

            <div className="pt-2 flex items-center gap-2">
              <Button size="sm" disabled={!canSign} onClick={() => setShowSignModal(true)}>
                Sign Contract
              </Button>
              <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/ideas/$id/validation', params: { id } })}>
                Back to validation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {signed && (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void navigate({ to: '/ideas/$id/evolution', params: { id } })}>
            Continue to evolution
          </Button>
        </div>
      )}

      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full space-y-4">
            <h3 className="text-sm font-semibold">Sign Contract (Irreversible)</h3>
            <p className="text-xs text-muted-foreground">
              Signing will lock product type, deadline, success metric, target N, and repository.
            </p>

            <CheckboxLine
              label="Step 1: I reviewed all contract terms and understand edits will be blocked after signing"
              checked={stepOneChecked}
              onChange={setStepOneChecked}
            />

            <Button
              size="sm"
              onClick={() => void handleSign()}
              disabled={!stepOneChecked || !secondReady || signing}
            >
              {signing ? 'Signing…' : secondReady ? 'Step 2: Confirm and sign' : 'Step 2 unlocks in a moment…'}
            </Button>

            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowSignModal(false);
                  setStepOneChecked(false);
                  setSecondReady(false);
                }}
                disabled={signing}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistItem({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center justify-between rounded border border-border px-3 py-2">
      <span>{label}</span>
      <StatusBadge status={checked ? 'done' : 'locked'} />
    </div>
  );
}

function CheckboxLine({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-xs text-foreground/90 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5"
      />
      <span>{label}</span>
    </label>
  );
}
