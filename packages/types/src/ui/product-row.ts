import type { IdeaStatus, ProductType, SuccessMetric } from '../enums/status'

/** Dashboard row — a denormalized read model for displaying idea cards. */
export interface ProductRow {
  id: string
  name: string
  slug: string | null
  status: IdeaStatus
  currentPhase: number

  productType: ProductType | null
  successMetric: SuccessMetric | null
  targetN: number | null
  marketCurrentValue: number
  marketVisible: boolean

  deadline: string | null
  contractSignedAt: string | null

  updatedAt: string
}
