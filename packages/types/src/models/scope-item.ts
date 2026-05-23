export type ScopeItemType = 'in_scope' | 'out_of_scope' | 'open_question'

export type ScopeItemStatus = 'confirmed' | 'needs_confirm' | 'pending'

export interface ScopeItem {
  id: string
  ideaId: string

  type: ScopeItemType
  title: string
  description: string | null
  status: ScopeItemStatus
  tags: string[]

  source: 'opus' | 'user'
  sortOrder: number

  createdAt: string
  updatedAt: string
}
