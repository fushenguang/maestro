export interface EvolutionNode {
  id: string
  ideaId: string

  version: string
  name: string
  description: string | null
  status: 'done' | 'current' | 'planned' | 'archived'

  nodeDate: string | null
  shippedAt: string | null

  openspecCount: number
  feedbackSignalCount: number
  triggeredByFeedback: string | null

  scopeCheckStatus: 'pending' | 'clean' | 'warning' | 'dismissed'
  scopeCheckRunAt: string | null
  scopeOutOfBounds: string[] | null
  scopeWarningDismissedAt: string | null
  scopeWarningDismissReason: string | null

  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface OpenspecChange {
  id: string
  ideaId: string
  nodeId: string

  title: string
  description: string | null
  specJson: Record<string, unknown>

  status: 'pending' | 'queued' | 'running' | 'done' | 'failed'
  triggeredAt: string | null

  createdAt: string
}
