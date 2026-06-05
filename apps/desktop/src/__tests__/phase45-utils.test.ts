import { describe, expect, it } from 'vitest';
import type { Idea } from '@maestro/types';
import {
  buildContractChecklist,
  canSignContract,
  evaluateMarketStatus,
  isScopeWarningBlocked,
} from '../lib/phase45-utils';

function makeIdea(overrides: Partial<Idea>): Idea {
  return {
    id: crypto.randomUUID(),
    userId: 'user-1',
    name: 'Test Idea',
    slug: null,
    description: null,
    tags: [],
    creatorMode: 'technical',
    productStage: 'build',
    stageEnteredAt: null,
    currentPhase: 4,
    status: 'active',
    feedSourceType: null,
    feedSourceUrl: null,
    feedRawContent: null,
    feedCompletedAt: null,
    intentClarity: 90,
    intentRounds: 0,
    openQuestionsCount: 0,
    intentCompletedAt: null,
    problemStatement: null,
    boundaryExportSha: null,
    boundaryLockedAt: new Date().toISOString(),
    validationVerdict: 'go',
    validationCompletedAt: new Date().toISOString(),
    contractSignedAt: null,
    contractId: null,
    productType: null,
    deadline: null,
    successMetric: null,
    targetN: null,
    deadlineExtensionsUsed: 0,
    extensionPostUrl: null,
    currentVersion: 'v0.1.0',
    githubRepo: null,
    githubRepoNodeId: null,
    marketCurrentValue: 0,
    marketLastCheckedAt: null,
    marketVisible: false,
    postmortemReport: null,
    postmortemAt: null,
    coolingEndsAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('contract signing gating', () => {
  it('requires all checklist items and valid form fields before sign', () => {
    const idea = makeIdea({});

    const checklist = buildContractChecklist(idea, true, true, true);
    expect(
      canSignContract(false, checklist, {
        deadline: '2026-12-31',
        githubRepo: 'owner/repo',
        targetN: 100,
      }),
    ).toBe(true);

    expect(
      canSignContract(false, { ...checklist, repoVerified: false }, {
        deadline: '2026-12-31',
        githubRepo: 'owner/repo',
        targetN: 100,
      }),
    ).toBe(false);
  });

  it('rejects resubmission after signed state is reached', () => {
    const checklist = buildContractChecklist(makeIdea({}), true, true, true);
    expect(
      canSignContract(true, checklist, {
        deadline: '2026-12-31',
        githubRepo: 'owner/repo',
        targetN: 100,
      }),
    ).toBe(false);
  });
});

describe('evolution scope warning gate', () => {
  it('blocks openspec trigger while scope status is warning', () => {
    expect(isScopeWarningBlocked('warning')).toBe(true);
    expect(isScopeWarningBlocked('clean')).toBe(false);
    expect(isScopeWarningBlocked('dismissed')).toBe(false);
  });
});

describe('market status transitions', () => {
  it('returns in_market when target is reached', () => {
    expect(
      evaluateMarketStatus({
        deadline: '2099-01-01',
        targetN: 100,
        currentValue: 100,
        now: new Date('2026-05-27T00:00:00.000Z'),
      }),
    ).toBe('in_market');
  });

  it('returns at_risk near deadline if target is not reached', () => {
    expect(
      evaluateMarketStatus({
        deadline: '2026-06-03',
        targetN: 100,
        currentValue: 20,
        now: new Date('2026-05-27T00:00:00.000Z'),
      }),
    ).toBe('at_risk');
  });

  it('returns force_closed after deadline if target is not reached', () => {
    expect(
      evaluateMarketStatus({
        deadline: '2026-05-20',
        targetN: 100,
        currentValue: 20,
        now: new Date('2026-05-27T00:00:00.000Z'),
      }),
    ).toBe('force_closed');
  });
});
