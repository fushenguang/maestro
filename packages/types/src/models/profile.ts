import type { UserType } from '../enums/status'

export interface Profile {
  id: string
  githubLogin: string
  githubAvatar: string | null
  displayName: string | null
  userType: UserType
  domain: string | null

  totalIdeas: number
  ideasInMarket: number
  ideasClosed: number
  launchRate: number

  githubConnected: boolean
  supabaseConnected: boolean
  stripeConnected: boolean
  feishuConnected: boolean
  feishuWebhookUrl: string | null

  prefOpusAuditNotify: boolean
  prefDeadlineIndicator: boolean
  prefAutoExportContext: boolean
  prefFeishuNotify: boolean

  createdAt: string
  updatedAt: string
}
