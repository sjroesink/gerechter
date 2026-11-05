import { createFileRoute } from '@tanstack/react-router'
import { createMcpRequestHandler } from '~/server/mcp/handler'
import { auth, db, env } from '~/server/runtime'

let handler: ReturnType<typeof createMcpRequestHandler> | undefined
const mcp = (request: Request) => {
  handler ??= createMcpRequestHandler({
    db: db(),
    auth: auth(),
    env: env(),
    // Eigen JWKS via loopback ophalen: de publieke URL is vanuit de container niet altijd bereikbaar.
    jwksUrl: `http://127.0.0.1:${env().PORT}/api/auth/jwks`,
  })
  return handler(request)
}

export const Route = createFileRoute('/mcp')({
  server: {
    handlers: {
      POST: ({ request }) => mcp(request),
      GET: ({ request }) => mcp(request),
      DELETE: ({ request }) => mcp(request),
    },
  },
})
