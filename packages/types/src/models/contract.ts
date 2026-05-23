import type { ProductType, SuccessMetric } from '../enums/status'

export interface Contract {
  id: string
  ideaId: string

  contractRef: string

  // all immutable after signedAt
  productType: ProductType
  deadline: string
  successMetric: SuccessMetric
  targetN: number
  githubRepo: string

  signedByUserId: string | null
  signedAt: string | null

  // one-time extension
  extensionRequestedAt: string | null
  extensionPostUrl: string | null
  extensionNewDeadline: string | null
  extensionApprovedAt: string | null

  createdAt: string
}
