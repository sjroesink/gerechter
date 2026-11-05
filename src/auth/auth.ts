import { betterAuth } from 'better-auth'
import { APIError } from 'better-auth/api'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { jwt } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { mcp } from '@better-auth/mcp'
import { cimd } from '@better-auth/cimd'
import { fetchClientMetadataResource } from '@better-auth/cimd/node'
import type { Db } from '~/db/client'
import type { Env } from '~/lib/env'
import { currentAuthFlow } from './context'

export const RESET_TOKEN_TTL_SECONDS = 24 * 60 * 60

export function mcpResource(env: Pick<Env, 'PUBLIC_BASE_URL'>) {
  return `${env.PUBLIC_BASE_URL}/mcp`
}

export function createAuth(db: Db, env: Env) {
  return betterAuth({
    appName: 'Gerechter',
    baseURL: env.PUBLIC_BASE_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', usePlural: false, camelCase: false }),
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    user: {
      additionalFields: {
        role: { type: 'string', required: false, defaultValue: 'user', input: false },
        lastActiveHouseholdId: { type: 'string', required: false, input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      revokeSessionsOnPasswordReset: true,
      // Er is geen e-mail: de link gaat terug naar de beheerder die hem aanvraagt (zie domain/accounts).
      sendResetPassword: async ({ token }) => {
        const flow = currentAuthFlow()
        if (flow) flow.capturedResetToken = token
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            // Registratie alleen via uitnodiging of bootstrap (domain/accounts zet de context).
            if (!currentAuthFlow()?.allowSignUp) {
              throw new APIError('FORBIDDEN', { message: 'Registreren kan alleen met een uitnodiging.' })
            }
            return { data: user }
          },
        },
      },
    },
    plugins: [
      jwt(),
      mcp({
        loginPage: '/login',
        consentPage: '/consent',
        resource: mcpResource(env),
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' }),
      tanstackStartCookies(),
    ],
  })
}

export type Auth = ReturnType<typeof createAuth>
