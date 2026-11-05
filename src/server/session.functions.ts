import { createServerFn } from '@tanstack/react-start'
import { isDomainError, NoActiveHousehold, resolveCtx } from '~/domain/core'
import { listMyHouseholds } from '~/domain/households'
import { appDeps, requestHeaders } from './fn'

export type Shell = {
  user: { id: string; name: string; email: string; isAdmin: boolean }
  household: { id: string; name: string; role: 'owner' | 'member' } | null
  households: { id: string; name: string }[]
}

/** Alles wat de app-schil nodig heeft; null als er geen sessie is. */
export const getShell = createServerFn({ method: 'GET' }).handler(async (): Promise<Shell | null> => {
  const deps = appDeps()
  const session = await deps.auth.api.getSession({ headers: requestHeaders() })
  if (!session) return null
  try {
    const ctx = await resolveCtx(deps.db, session.user.id)
    const households = await listMyHouseholds(ctx)
    return {
      user: {
        id: ctx.user.id,
        name: ctx.user.name,
        email: ctx.user.email,
        isAdmin: ctx.user.role === 'admin',
      },
      household: ctx.household,
      households: households.map((h) => ({ id: h.id, name: h.name })),
    }
  } catch (error) {
    if (!(error instanceof NoActiveHousehold) && !isDomainError(error)) throw error
    return {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        isAdmin: (session.user as { role?: string }).role === 'admin',
      },
      household: null,
      households: [],
    }
  }
})

export const isLoggedIn = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await appDeps().auth.api.getSession({ headers: requestHeaders() })
  return session !== null
})
