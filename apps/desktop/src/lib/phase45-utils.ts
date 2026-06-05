import type { Idea } from '@maestro/types';

export interface ContractChecklist {
  boundaryLocked: boolean;
  validationGo: boolean;
  repoVerified: boolean;
  userConfirmedBoundary: boolean;
  userConfirmedIrreversible: boolean;
}

export interface ContractFormCheck {
  deadline: string;
  githubRepo: string;
  targetN: number;
}

export function buildContractChecklist(
  idea: Idea | null,
  repoVerified: boolean,
  userConfirmedBoundary: boolean,
  userConfirmedIrreversible: boolean,
): ContractChecklist {
  return {
    boundaryLocked: Boolean(idea?.boundaryLockedAt),
    validationGo: idea?.validationVerdict === 'go',
    repoVerified,
    userConfirmedBoundary,
    userConfirmedIrreversible,
  };
}

export function canSignContract(
  signed: boolean,
  checklist: ContractChecklist,
  form: ContractFormCheck,
): boolean {
  if (signed) return false;
  if (!form.deadline || !form.githubRepo || !form.targetN) return false;
  return Object.values(checklist).every(Boolean);
}

export function isScopeWarningBlocked(scopeCheckStatus: string | null | undefined): boolean {
  return scopeCheckStatus === 'warning';
}

export function evaluateMarketStatus(params: {
  deadline: string | null;
  targetN: number | null;
  currentValue: number;
  now?: Date;
}): 'active' | 'at_risk' | 'in_market' | 'force_closed' {
  const { deadline, targetN, currentValue } = params;
  const now = params.now ?? new Date();

  if (targetN != null && currentValue >= targetN) return 'in_market';
  if (!deadline) return 'active';

  const deadlineTs = new Date(`${deadline}T00:00:00.000Z`).getTime();
  if (Number.isNaN(deadlineTs)) return 'active';

  const days = Math.floor((deadlineTs - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'force_closed';
  if (days < 14) return 'at_risk';
  return 'active';
}
