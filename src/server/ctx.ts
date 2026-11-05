import type { Auth } from '~/auth/auth'
import type { Db } from '~/db/client'
import { loadUserCtx, resolveCtx, Unauthenticated, type Ctx, type UserCtx } from '~/domain/core'

type Deps = { db: Db; auth: Auth }

async function sessionUserId(headers: Headers, deps: Deps): Promise<string> {
  const session = await deps.auth.api.getSession({ headers })
  if (!session) throw new Unauthenticated()
  return session.user.id
}

/** Context voor server functions die huishoudgegevens raken. */
export async function ctxFromSession(headers: Headers, deps: Deps): Promise<Ctx> {
  return resolveCtx(deps.db, await sessionUserId(headers, deps))
}

/** Context voor server functions van een ingelogde gebruiker die (nog) geen huishouden nodig hebben. */
export async function userCtxFromSession(headers: Headers, deps: Deps): Promise<UserCtx> {
  return loadUserCtx(deps.db, await sessionUserId(headers, deps))
}
