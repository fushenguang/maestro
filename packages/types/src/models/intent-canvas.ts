export type FieldStatus = 'confirmed' | 'partial' | 'empty'

export interface IntentCanvas {
  id: string
  ideaId: string

  problem: string | null
  rootCause: string | null
  mechanism: string | null
  targetUser: string | null
  successMetricDesc: string | null
  boundaryHint: string | null

  problemConfidence: number
  rootCauseConfidence: number
  mechanismConfidence: number
  targetUserConfidence: number

  updatedAt: string
}
