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
export type AhProductResult = {
  id: number
  title: string
  brand: string | null
  price: number | null
  isBonus: boolean | null
  bonusLabel: string | null
  unitSize: string | null
  imageUrl: string | null
}
export interface AhProductSearch {
  search(
    connection: { destinationId: string; secret: string },
    query: string,
    limit: number,
  ): Promise<AhProductResult[]>
}
export type ShoppingDeps = {
  secret: string
  targets: Partial<Record<ShoppingTargetId, ShoppingTarget>>
  ahProducts?: AhProductSearch
}
