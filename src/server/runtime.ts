import { createAuth, type Auth } from '~/auth/auth'
import { db } from '~/db/client'
import { env } from '~/lib/env'

let authInstance: Auth | undefined

/** De gedeelde Better Auth-instantie van de draaiende app. */
export function auth(): Auth {
  authInstance ??= createAuth(db(), env())
  return authInstance
}

export { db, env }
