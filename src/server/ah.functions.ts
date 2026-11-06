import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { Invalid, isDomainError, requireOwner, type Ctx } from '~/domain/core'
import {
  getAhConnectionReference,
  getShoppingTargets,
  removeShoppingConnection,
  saveAhConnection,
} from '~/domain/shopping-sync'
import { sessionCtx, toResult } from './fn'
import { env } from './runtime'
import { ahSidecar } from './shopping-targets/ah'

function sidecar() {
  const config = env()
  if (!config.AH_SIDECAR_URL || !config.AH_SIDECAR_SECRET)
    throw new Invalid('AH is niet ingeschakeld op deze installatie.')
  return ahSidecar({ url: config.AH_SIDECAR_URL, secret: config.AH_SIDECAR_SECRET })
}
async function previousReference(ctx: Ctx) {
  try {
    return await getAhConnectionReference(ctx, env().BETTER_AUTH_SECRET)
  } catch (error) {
    if (isDomainError(error) && error.code === 'INVALID') return null
    throw error
  }
}
export const connectAhFn = createServerFn({ method: 'POST' })
  .validator(z.object({ code: z.string().trim().min(1).max(4096) }).strict())
  .handler(({ data }) =>
    toResult(async () => {
      const ctx = await sessionCtx()
      requireOwner(ctx)
      const client = sidecar(),
        old = await previousReference(ctx)
      const reference = await client.connect(ctx.household.id, data.code)
      try {
        const status = await saveAhConnection(ctx, reference, env().BETTER_AUTH_SECRET)
        if (old) await client.disconnect(old)
        return { ...status, message: 'AH-verbinding ingesteld. Er zijn geen boodschappen verzonden.' }
      } catch (error) {
        await client.disconnect(reference)
        throw error
      }
    }),
  )
export const disconnectAhFn = createServerFn({ method: 'POST' }).handler(() =>
  toResult(async () => {
    const ctx = await sessionCtx()
    requireOwner(ctx)
    const reference = await previousReference(ctx)
    let remoteRemoved = !reference
    if (reference) {
      try {
        remoteRemoved = await sidecar().disconnect(reference)
      } catch {
        remoteRemoved = false
      }
    }
    await removeShoppingConnection(ctx, 'ah')
    return {
      ...(await getShoppingTargets(ctx)),
      message: remoteRemoved
        ? 'AH-verbinding losgekoppeld. De exporthistorie blijft bewaard.'
        : 'AH is in Gerechter losgekoppeld. De AH-service kon de oude tokenopslag nu niet bevestigen als verwijderd.',
    }
  }),
)
