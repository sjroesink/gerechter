import { requireMcpAuth } from '@better-auth/mcp'
import { createMcpHandler } from '@modelcontextprotocol/server'
import { mcpResource, type Auth } from '~/auth/auth'
import type { Db } from '~/db/client'
import { hasConsent } from '~/domain/connected-apps'
import type { Env } from '~/lib/env'
import { buildMcpServer, ctxFromMcpToken } from './server'

/**
 * Request-handler voor `/mcp`: OAuth-token verplicht, daarna een stateless MCP-server per verzoek.
 *
 * `jwksUrl`: waar de server zijn eigen signeersleutels ophaalt om tokens te controleren. Standaard via de
 * publieke URL; in een container is die vaak niet bereikbaar, dus de app geeft daar het interne adres mee.
 */
export function createMcpRequestHandler(deps: {
  db: Db
  auth: Auth
  env: Pick<Env, 'PUBLIC_BASE_URL'>
  jwksUrl?: string
}) {
  const metadataUrl = `${deps.env.PUBLIC_BASE_URL}/.well-known/oauth-protected-resource/mcp`
  return requireMcpAuth(
    deps.auth,
    async (request, claims) => {
      const clientId =
        typeof claims.azp === 'string' ? claims.azp : (claims as { client_id?: string }).client_id
      if (!claims.sub || !clientId || !(await hasConsent(deps.db, claims.sub, clientId))) {
        return Response.json(
          { error: 'invalid_token', error_description: 'De toegang van deze app is ingetrokken.' },
          {
            status: 401,
            headers: {
              'www-authenticate': `Bearer error="invalid_token", resource_metadata="${metadataUrl}"`,
            },
          },
        )
      }
      const handler = createMcpHandler(() => buildMcpServer(() => ctxFromMcpToken(deps.db, claims)))
      return handler.fetch(request)
    },
    { resource: mcpResource(deps.env), ...(deps.jwksUrl ? { jwksUrl: deps.jwksUrl } : {}) },
  )
}
