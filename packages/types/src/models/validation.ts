export type ValidationVerdict = 'go' | 'no_go' | 'pending'

export interface EvidenceItem {
  id: string
  ideaId: string

  passType: 'advocate' | 'prosecutor'
  badge:
    | 'proves_problem'
    | 'adjacent_signal'
    | 'adoption_risk'
    | 'evidence_gap'
    | 'fatal_risk'
  title: string
  description: string
  sourceUrl: string | null

  sortOrder: number
  createdAt: string
}

export interface ValidationReport {
  id: string
  ideaId: string

  verdict: ValidationVerdict | null
  verdictSummary: string | null

  marketSizeSignal: string | null
  competingProducts: number | null
  payingCustomersFound: number

  // advocate pass
  advocateGoReasons: string[] | null
  advocateCompletedAt: string | null

  // prosecutor pass
  prosecutorRisks: string[] | null
  prosecutorCompletedAt: string | null

  // synthesis
  synthesisNotes: string | null
  evidenceGaps: string[] | null

  modelUsed: string
  generatedAt: string
}
