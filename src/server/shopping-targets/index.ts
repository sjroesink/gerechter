import type { ShoppingDeps } from '~/domain/shopping-target'
import { env } from '../runtime'
import { notionTarget } from './notion'
import { ahSidecar, type AhSidecarConfig } from './ah'

export function shoppingDeps(): ShoppingDeps {
  const config = env()
  return createShoppingDeps(config.BETTER_AUTH_SECRET, {
    url: config.AH_SIDECAR_URL,
    secret: config.AH_SIDECAR_SECRET,
  })
}

export function createShoppingDeps(secret: string, ah?: AhSidecarConfig): ShoppingDeps {
  const sidecar = ah?.url && ah.secret ? ahSidecar(ah) : null
  return {
    secret,
    targets: {
      share: { send: async () => ({ status: 'pending' }) },
      notion: notionTarget(),
      ...(sidecar ? { ah: sidecar.target } : {}),
    },
    ...(sidecar ? { ahProducts: sidecar.products } : {}),
  }
}
