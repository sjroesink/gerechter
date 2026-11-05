import { getRequest } from '@tanstack/react-start/server'
import { isDomainError, type Ctx, type DomainErrorCode, type UserCtx } from '~/domain/core'
import { ctxFromSession, userCtxFromSession } from './ctx'
import { auth, db, env } from './runtime'

export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; code: DomainErrorCode; message: string }

/** Zet domeinfouten om naar een resultaat dat een formulier kan tonen; andere fouten gaan door. */
export async function toResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (error) {
    if (isDomainError(error)) return { ok: false, code: error.code, message: error.message }
    throw error
  }
}

export function appDeps() {
  return { db: db(), auth: auth(), env: env() }
}

export function requestHeaders(): Headers {
  return getRequest().headers
}

export function sessionCtx(): Promise<Ctx> {
  return ctxFromSession(requestHeaders(), appDeps())
}

export function sessionUserCtx(): Promise<UserCtx> {
  return userCtxFromSession(requestHeaders(), appDeps())
}
