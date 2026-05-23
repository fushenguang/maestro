import type {
  IdeaStatus,
  ProductType,
  SuccessMetric,
  FeedSourceType,
  UserType,
  ProductStage,
} from '../enums/status'

export interface Idea {
  id: string
  userId: string

  // identity
  name: string
  slug: string | null
  description: string | null
  tags: string[]

  creatorMode: UserType
  productStage: ProductStage
  stageEnteredAt: string | null

  // phase state
  currentPhase: number
  status: IdeaStatus

  // phase 0: feed
  feedSourceType: FeedSourceType | null
  feedSourceUrl: string | null
  feedRawContent: string | null
  feedCompletedAt: string | null

  // phase 1: intent dialogue
  intentClarity: number
  intentRounds: number
  openQuestionsCount: number
  intentCompletedAt: string | null

  // phase 2: boundary definition
  problemStatement: string | null
  boundaryLockedAt: string | null
  boundaryExportSha: string | null

  // phase 3: validation gate
  validationVerdict: 'go' | 'no_go' | 'pending' | null
  validationCompletedAt: string | null

  // phase 4: product contract (immutable after contractSignedAt)
  contractSignedAt: string | null
  contractId: string | null
  productType: ProductType | null
  deadline: string | null
  successMetric: SuccessMetric | null
  targetN: number | null
  deadlineExtensionsUsed: number
  extensionPostUrl: string | null

  // phase 5: evolution
  currentVersion: string
  githubRepo: string | null
  githubRepoNodeId: string | null

  // market signal
  marketCurrentValue: number
  marketLastCheckedAt: string | null
  marketVisible: boolean

  // post-mortem
  postmortemReport: string | null
  postmortemAt: string | null
  coolingEndsAt: string | null

  createdAt: string
  updatedAt: string
}
