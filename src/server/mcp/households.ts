import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { resolveCtx, type Ctx } from '~/domain/core'
import { listMyHouseholds, switchHousehold } from '~/domain/households'
import { tool } from './context-tool'

export function registerHouseholdTools(server: McpServer, getCtx: () => Promise<Ctx>) {
  server.registerTool(
    'list_households',
    {
      title: 'Mijn huishoudens',
      description:
        'Lees uitsluitend de huishoudens waarvan je lid bent, met je rol en het actieve huishouden. Wisselt niets.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    () =>
      tool(getCtx, async (ctx) => ({
        activeHousehold: ctx.household,
        households: await listMyHouseholds(ctx),
      })),
  )
  server.registerTool(
    'switch_household',
    {
      title: 'Actief huishouden kiezen',
      description:
        'Kies expliciet een eigen huishouden uit list_households. Wijzigt de bewaarde keuze voor deze gebruiker, ook in de webapp en andere clients. Volgende inhoudelijke tools werken in dat huishouden. Een vreemde ID wordt geweigerd.',
      inputSchema: z.object({ householdId: z.string().uuid() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ householdId }) =>
      tool(getCtx, async (ctx) => {
        await switchHousehold(ctx, householdId)
        const next = await resolveCtx(ctx.db, ctx.user.id)
        return { activeHousehold: next.household, households: await listMyHouseholds(next) }
      }),
  )
}
