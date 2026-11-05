import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod'
import type { Db } from '~/db/client'
import { isDomainError, resolveCtx, type Ctx } from '~/domain/core'
import { listMyHouseholds } from '~/domain/households'

/** Context voor een MCP-aanroep: altijd namens de gebruiker van het token, in diens actieve huishouden. */
export function ctxFromMcpToken(db: Db, claims: { sub?: string }): Promise<Ctx> {
  if (!claims.sub) throw new Error('Token zonder gebruiker')
  return resolveCtx(db, claims.sub)
}

type ToolResult = { content: { type: 'text'; text: string }[]; isError?: boolean }

/** Dunne adapter: bouw een Ctx, roep de domeinlaag aan, en zet domeinfouten om naar een toolfout. */
async function tool(getCtx: () => Promise<Ctx>, run: (ctx: Ctx) => Promise<unknown>): Promise<ToolResult> {
  try {
    const result = await run(await getCtx())
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  } catch (error) {
    if (isDomainError(error)) return { content: [{ type: 'text', text: error.message }], isError: true }
    throw error
  }
}

export function buildMcpServer(getCtx: () => Promise<Ctx>): McpServer {
  const server = new McpServer({ name: 'gerechter', version: '0.1.0' })

  server.registerTool(
    'whoami',
    {
      title: 'Wie ben ik',
      description:
        'Geeft de ingelogde gebruiker, het actieve huishouden (met rol) en alle huishoudens waar de gebruiker lid van is.',
      inputSchema: z.object({}),
    },
    () =>
      tool(getCtx, async (ctx) => ({
        user: { name: ctx.user.name, email: ctx.user.email },
        activeHousehold: { id: ctx.household.id, name: ctx.household.name, role: ctx.household.role },
        households: await listMyHouseholds(ctx),
      })),
  )

  return server
}
