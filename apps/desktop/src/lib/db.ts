/**
 * db.ts — Typed wrappers around every Tauri command in the data layer.
 *
 * Usage:
 *   import { db } from '@/lib/db'
 *   const ideas = await db.ideas.list()
 */

import { invoke } from '@tauri-apps/api/core'
import type {
  Profile,
  Idea,
  IntentCanvas,
  ScopeItem,
  ValidationReport,
  EvidenceItem,
  Contract,
  EvolutionNode,
  OpenspecChange,
} from '@maestro/types'

// ---------------------------------------------------------------------------
// Tauri IPC helpers
// ---------------------------------------------------------------------------

function parseJsonArray(v: string | string[]): string[] {
  if (Array.isArray(v)) return v
  try { return JSON.parse(v) as string[] } catch { return [] }
}

/**
 * Tauri serialises the SQLite `tags TEXT` column as a raw JSON string
 * (e.g. `"[\"devtools\"]"`). This helper parses it back into string[].
 */
function parseIdea(raw: unknown): Idea {
  const r = raw as Idea & { tags: string | string[] }
  return { ...r, tags: parseJsonArray(r.tags) }
}

/** ScopeItem also has a `tags TEXT` column serialised the same way. */
function parseScopeItem(raw: unknown): ScopeItem {
  const r = raw as ScopeItem & { tags: string | string[] }
  return { ...r, tags: parseJsonArray(r.tags) }
}

function parseEvolutionNode(raw: unknown): EvolutionNode {
  const r = raw as EvolutionNode & { scopeOutOfBounds: string | string[] | null }
  return {
    ...r,
    scopeOutOfBounds: r.scopeOutOfBounds == null ? null : parseJsonArray(r.scopeOutOfBounds),
  }
}

function parseOpenspecChange(raw: unknown): OpenspecChange {
  const r = raw as OpenspecChange & { specJson: string | Record<string, unknown> }
  let specJson: Record<string, unknown> = {}
  if (typeof r.specJson === 'string') {
    try {
      specJson = JSON.parse(r.specJson || '{}') as Record<string, unknown>
    } catch {
      specJson = {}
    }
  } else {
    specJson = r.specJson
  }

  return {
    ...r,
    specJson,
  }
}

// ---------------------------------------------------------------------------
// Local input types (not in @maestro/types — Rust-side only)
// ---------------------------------------------------------------------------

export interface UpsertProfileInput {
  id: string
  githubLogin: string
  githubAvatar?: string | null
  displayName?: string | null
  userType?: string
  domain?: string | null
}

export interface CreateIdeaInput {
  userId: string
  name: string
  description?: string | null
  tags?: string[]
  creatorMode?: string
}

export interface UpdateIdeaInput {
  name?: string
  description?: string | null
  tags?: string[]
  status?: string
  currentPhase?: number
  feedSourceType?: string | null
  feedSourceUrl?: string | null
  feedRawContent?: string | null
  feedCompletedAt?: string | null
  intentClarity?: number
  intentRounds?: number
  openQuestionsCount?: number
  intentCompletedAt?: string | null
  problemStatement?: string | null
  boundaryExportSha?: string | null
  validationVerdict?: string | null
  validationCompletedAt?: string | null
  productType?: string | null
  deadline?: string | null
  successMetric?: string | null
  targetN?: number | null
  githubRepo?: string | null
  currentVersion?: string
  postmortemReport?: string | null
}

export interface UpsertIntentCanvasInput {
  ideaId: string
  problem?: string | null
  rootCause?: string | null
  mechanism?: string | null
  targetUser?: string | null
  successMetricDesc?: string | null
  boundaryHint?: string | null
  problemConfidence?: number
  rootCauseConfidence?: number
  mechanismConfidence?: number
  targetUserConfidence?: number
}

export interface UpsertScopeItemInput {
  id?: string
  ideaId: string
  type: 'in_scope' | 'out_of_scope' | 'open_question'
  title: string
  description?: string | null
  status?: 'confirmed' | 'needs_confirm' | 'pending'
  tags?: string[]
  source?: 'opus' | 'user'
  sortOrder?: number
}

export interface UpsertValidationReportInput {
  ideaId: string
  verdict?: 'go' | 'no_go' | 'pending' | null
  verdictSummary?: string | null
  marketSizeSignal?: string | null
  competingProducts?: number | null
  payingCustomersFound?: number | null
  advocateGoReasons?: string[]
  advocateCompletedAt?: string | null
  prosecutorRisks?: string[]
  prosecutorCompletedAt?: string | null
  synthesisNotes?: string | null
  evidenceGaps?: string[]
  modelUsed?: string
}

export interface AddEvidenceItemInput {
  ideaId: string
  passType: 'advocate' | 'prosecutor'
  badge: 'proves_problem' | 'adjacent_signal' | 'adoption_risk' | 'evidence_gap' | 'fatal_risk'
  title: string
  description: string
  sourceUrl?: string | null
  sortOrder?: number
}

export interface SignContractInput {
  productType: 'paid' | 'opensource' | 'internal'
  deadline: string
  successMetric: 'paid_users' | 'github_stars' | 'weekly_downloads' | 'url_reachable'
  targetN: number
  githubRepo: string
  signedByUserId?: string | null
}

export interface AddDialogueMessageInput {
  ideaId: string
  role: 'opus' | 'user'
  content: string
  round: number
  tokensUsed?: number | null
  modelUsed?: string | null
}

export interface DialogueMessage {
  id: string
  ideaId: string
  role: 'opus' | 'user'
  content: string
  round: number
  tokensUsed: number | null
  modelUsed: string | null
  createdAt: string
}

export interface CreateEvolutionNodeInput {
  ideaId: string
  version: string
  name: string
  description?: string | null
  status?: 'done' | 'current' | 'planned' | 'archived'
  nodeDate?: string | null
  sortOrder?: number
}

export interface ExportContractArtifactInput {
  token: string
  ideaId: string
  owner: string
  repo: string
}

export interface RepoVerifyResult {
  ok: boolean
  owner?: string | null
  repo?: string | null
  message: string
}

export interface MarketRefreshResult {
  ideaId: string
  successMetric: string
  currentValue?: number | null
  updatedStatus?: string | null
  refreshed: boolean
  message: string
}

export interface DueIdeasStatusResult {
  refreshedCount: number
  changedStatusCount: number
}

export interface ArchDecisionLog {
  id: string
  openspecId: string
  ideaId: string
  nodeId: string
  decisions: string[]
  depsAdded: string[]
  depsRemoved: string[]
  filesChanged: string[]
  agentNotes: string | null
  exportedToContextAt: string | null
  contextCommitSha: string | null
  modelUsed: string
  writtenAt: string
}

export interface DismissScopeWarningInput {
  nodeId: string
  reason: string
}

export interface CompleteOpenspecChangeInput {
  openspecId: string
  decisions: string[]
  depsAdded?: string[]
  depsRemoved?: string[]
  filesChanged?: string[]
  agentNotes?: string | null
  modelUsed?: string
}

function parseArchLog(raw: unknown): ArchDecisionLog {
  const r = raw as Omit<ArchDecisionLog, 'decisions' | 'depsAdded' | 'depsRemoved' | 'filesChanged'> & {
    decisions: string | string[]
    depsAdded: string | string[]
    depsRemoved: string | string[]
    filesChanged: string | string[]
  }

  return {
    ...r,
    decisions: parseJsonArray(r.decisions),
    depsAdded: parseJsonArray(r.depsAdded),
    depsRemoved: parseJsonArray(r.depsRemoved),
    filesChanged: parseJsonArray(r.filesChanged),
  }
}

// ---------------------------------------------------------------------------
// db — the exported singleton
// ---------------------------------------------------------------------------

export const db = {
  profile: {
    /** Returns the local profile (single user, MVP). */
    get: (): Promise<Profile | null> =>
      invoke<Profile | null>('get_profile'),

    upsert: (data: UpsertProfileInput): Promise<Profile> =>
      invoke<Profile>('upsert_profile', { data }),
  },

  ideas: {
    list: (): Promise<Idea[]> =>
      invoke<unknown[]>('get_ideas').then(r => r.map(parseIdea)),

    get: (id: string): Promise<Idea> =>
      invoke<unknown>('get_idea', { id }).then(parseIdea),

    create: (data: CreateIdeaInput): Promise<Idea> =>
      invoke<unknown>('create_idea', { data }).then(parseIdea),

    update: (id: string, data: UpdateIdeaInput): Promise<Idea> =>
      invoke<unknown>('update_idea', { id, data }).then(parseIdea),

    delete: (id: string): Promise<void> =>
      invoke<void>('delete_idea', { id }),
  },

  dialogue: {
    list: (ideaId: string): Promise<DialogueMessage[]> =>
      invoke<DialogueMessage[]>('get_dialogue_messages', { ideaId }),

    add: (data: AddDialogueMessageInput): Promise<DialogueMessage> =>
      invoke<DialogueMessage>('add_dialogue_message', { data }),
  },

  intent: {
    get: (ideaId: string): Promise<IntentCanvas | null> =>
      invoke<IntentCanvas | null>('get_intent_canvas', { ideaId }),

    upsert: (data: UpsertIntentCanvasInput): Promise<IntentCanvas> =>
      invoke<IntentCanvas>('upsert_intent_canvas', { data }),
  },

  boundary: {
    list: (ideaId: string): Promise<ScopeItem[]> =>
      invoke<unknown[]>('get_scope_items', { ideaId }).then(r => r.map(parseScopeItem)),

    upsert: (data: UpsertScopeItemInput): Promise<ScopeItem> =>
      invoke<unknown>('upsert_scope_item', { data }).then(parseScopeItem),

    delete: (id: string): Promise<void> =>
      invoke<void>('delete_scope_item', { id }),

    deleteOpusItems: (ideaId: string): Promise<void> =>
      invoke<void>('delete_scope_items_by_source', { ideaId, source: 'opus' }),

    lock: (ideaId: string): Promise<void> =>
      invoke<void>('lock_boundary', { ideaId }),
  },

  validation: {
    getReport: (ideaId: string): Promise<ValidationReport | null> =>
      invoke<ValidationReport | null>('get_validation_report', { ideaId }),

    upsertReport: (data: UpsertValidationReportInput): Promise<ValidationReport> =>
      invoke<ValidationReport>('upsert_validation_report', { data }),

    deleteReport: (ideaId: string): Promise<void> =>
      invoke<void>('delete_validation_report', { ideaId }),

    getEvidence: (ideaId: string): Promise<EvidenceItem[]> =>
      invoke<EvidenceItem[]>('get_evidence_items', { ideaId }),

    addEvidence: (data: AddEvidenceItemInput): Promise<EvidenceItem> =>
      invoke<EvidenceItem>('add_evidence_item', { data }),

    deleteEvidence: (ideaId: string): Promise<void> =>
      invoke<void>('delete_evidence_items', { ideaId }),
  },

  contracts: {
    get: (ideaId: string): Promise<Contract | null> =>
      invoke<Contract | null>('get_contract', { ideaId }),

    sign: (ideaId: string, data: SignContractInput): Promise<Contract> =>
      invoke<Contract>('sign_contract', { ideaId, data }),

    exportArtifact: (data: ExportContractArtifactInput): Promise<string> =>
      invoke<string>('export_contract_artifact', { data }),
  },

  evolution: {
    listNodes: (ideaId: string): Promise<EvolutionNode[]> =>
      invoke<unknown[]>('get_evolution_nodes', { ideaId }).then((rows) => rows.map(parseEvolutionNode)),

    createNode: (data: CreateEvolutionNodeInput): Promise<EvolutionNode> =>
      invoke<unknown>('create_evolution_node', { data }).then(parseEvolutionNode),

    listChanges: (ideaId: string): Promise<OpenspecChange[]> =>
      invoke<unknown[]>('get_openspec_changes', { ideaId }).then((rows) => rows.map(parseOpenspecChange)),

    listArchLogs: (ideaId: string): Promise<ArchDecisionLog[]> =>
      invoke<unknown[]>('get_arch_decision_logs', { ideaId }).then((rows) => rows.map(parseArchLog)),

    dismissWarning: (data: DismissScopeWarningInput): Promise<EvolutionNode> =>
      invoke<unknown>('dismiss_scope_warning', { data }).then(parseEvolutionNode),

    completeWithArchLog: (data: CompleteOpenspecChangeInput): Promise<ArchDecisionLog> =>
      invoke<unknown>('complete_openspec_change_with_arch_log', {
        data: {
          ...data,
          depsAdded: data.depsAdded ?? [],
          depsRemoved: data.depsRemoved ?? [],
          filesChanged: data.filesChanged ?? [],
        },
      }).then(parseArchLog),
  },

  market: {
    verifyRepo: (repo: string): Promise<RepoVerifyResult> =>
      invoke<RepoVerifyResult>('verify_github_repo', { repo }),

    refreshSignal: (ideaId: string): Promise<MarketRefreshResult> =>
      invoke<MarketRefreshResult>('refresh_market_signal', { ideaId }),

    refreshDueIdeasStatus: (): Promise<DueIdeasStatusResult> =>
      invoke<DueIdeasStatusResult>('refresh_due_ideas_status'),
  },
}

// ---------------------------------------------------------------------------
// GitHub helpers (wrapping the Tauri github_commit_file command)
// ---------------------------------------------------------------------------

export interface GitHubCommitInput {
  token: string;
  owner: string;
  repo: string;
  path: string;
  content: string;
  message: string;
}

/** Commit a file to a GitHub repository. Returns commit SHA. */
export function githubCommitFile(data: GitHubCommitInput): Promise<string> {
  return invoke<string>('github_commit_file', { data });
}
