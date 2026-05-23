export type IdeaStatus =
  | 'draft'
  | 'active'
  | 'at_risk'
  | 'in_market'
  | 'force_closed'
  | 'closed_no_go'

export type ProductType = 'paid' | 'opensource' | 'internal'

export type SuccessMetric =
  | 'paid_users'
  | 'github_stars'
  | 'weekly_downloads'
  | 'url_reachable'

export type FeedSourceType = 'text' | 'url' | 'github' | 'file'

export type UserType = 'technical' | 'domain_expert'

export type ProductStage = 'build' | 'launch' | 'scale'
