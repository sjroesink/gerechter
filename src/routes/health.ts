import { createFileRoute } from '@tanstack/react-router'
import { healthResponse } from '~/server/health'
import { db } from '~/server/runtime'

export const Route = createFileRoute('/health')({
  server: { handlers: { GET: () => healthResponse(db()) } },
})
