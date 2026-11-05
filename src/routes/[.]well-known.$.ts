import { createFileRoute } from '@tanstack/react-router'
import { auth } from '~/server/runtime'

/** OAuth-discovery voor MCP-clients (RFC 8414 / RFC 9728) op de root; Better Auth beantwoordt ze. */
export const Route = createFileRoute('/.well-known/$')({
  server: {
    handlers: { GET: ({ request }) => auth().handler(request) },
  },
})
