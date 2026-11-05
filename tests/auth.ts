import { createAuth } from '~/auth/auth'
import { runAuthFlow } from '~/auth/context'
import type { Db } from '~/db/client'
import { parseEnv } from '~/lib/env'

export const testEnv = parseEnv({
  DATABASE_URL: 'postgres://ongebruikt@localhost/ongebruikt',
  PUBLIC_BASE_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-00',
  ADMIN_EMAIL: 'admin@example.com',
})

export function createTestAuth(db: Db) {
  return createAuth(db, testEnv)
}

export type TestAuth = ReturnType<typeof createTestAuth>

/** Registreert een account buiten de uitnodigingsregels om en geeft request-headers met de sessiecookie terug. */
export async function signUpWithSession(auth: TestAuth, name = 'Testgebruiker') {
  const email = `user-${crypto.randomUUID()}@example.com`
  const password = 'een-goed-wachtwoord'
  const result = await runAuthFlow({ allowSignUp: true }, () =>
    auth.api.signUpEmail({ body: { name, email, password }, returnHeaders: true }),
  )
  return { userId: result.response.user.id, email, password, headers: cookieHeaders(result.headers) }
}

export async function signInWithSession(auth: TestAuth, email: string, password: string) {
  const result = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true })
  return cookieHeaders(result.headers)
}

export function cookieHeaders(responseHeaders: Headers): Headers {
  const cookies = responseHeaders
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
  return new Headers({ cookie: cookies })
}
