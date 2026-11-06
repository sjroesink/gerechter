import type { ShoppingTargetId } from '~/db/schema/shopping'
import type { ShoppingNeeds } from './shopping-types'

export type ShoppingProviderResult = {
  status: 'pending' | 'succeeded' | 'failed' | 'uncertain'
  externalId?: string
  externalUrl?: string
  message?: string
  verifiedAbsent?: boolean
}
export type ShoppingProviderRequest = {
  runId: string
  needs: ShoppingNeeds
  externalId?: string | null
  connection: { destinationId: string; secret: string } | null
}
export interface ShoppingTarget {
  send(request: ShoppingProviderRequest): Promise<ShoppingProviderResult>
  check?(request: ShoppingProviderRequest): Promise<ShoppingProviderResult>
}
export type ShoppingDeps = { secret: string; targets: Partial<Record<ShoppingTargetId, ShoppingTarget>> }
