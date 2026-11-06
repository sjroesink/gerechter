import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod'
import type { Db } from '~/db/client'
import { resolveCtx, type Ctx } from '~/domain/core'
import { listMyHouseholds } from '~/domain/households'
import { registerCatalogTools } from './catalog'
import { registerRecipeTools } from './recipes'
import { registerPantryTools } from './pantry'
import { registerPlanningTools } from './planning'
import { registerCookingTools } from './cooking'
import { registerShoppingTools } from './shopping'
import { registerAhProductTools } from './ah-products'
import type { ShoppingDeps } from '~/domain/shopping-target'
import { tool } from './context-tool'
import { registerHouseholdTools } from './households'
import { agentGuide, agentInstructions } from './guide'
import type { RecipeImportDeps } from '../recipe-import'

/** Context voor een MCP-aanroep: altijd namens de gebruiker van het token, in diens actieve huishouden. */
export function ctxFromMcpToken(db: Db, claims: { sub?: string }): Promise<Ctx> {
  if (!claims.sub) throw new Error('Token zonder gebruiker')
  return resolveCtx(db, claims.sub)
}

export function buildMcpServer(
  getCtx: () => Promise<Ctx>,
  shopping: ShoppingDeps,
  recipeImport: RecipeImportDeps,
): McpServer {
  const server = new McpServer({ name: 'gerechter', version: '0.2.0' }, { instructions: agentInstructions })
  registerHouseholdTools(server, getCtx)
  registerCatalogTools(server, getCtx)
  registerRecipeTools(server, getCtx, recipeImport)
  registerPantryTools(server, getCtx)
  registerPlanningTools(server, getCtx)
  registerCookingTools(server, getCtx)
  registerShoppingTools(server, getCtx, shopping)
  registerAhProductTools(server, getCtx, shopping)

  server.registerTool(
    'whoami',
    {
      title: 'Wie ben ik',
      description:
        'Geeft de ingelogde gebruiker, het actieve huishouden (met rol) en alle huishoudens waar de gebruiker lid van is.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    () =>
      tool(getCtx, async (ctx) => ({
        user: { name: ctx.user.name, email: ctx.user.email },
        activeHousehold: { id: ctx.household.id, name: ctx.household.name, role: ctx.household.role },
        households: await listMyHouseholds(ctx),
      })),
  )

  server.registerTool(
    'get_agent_guide',
    {
      title: 'Werkwijzer voor agents',
      description:
        'Lees de volledige werkwijzer: toolgroepen, huishoudcontext, zoeken en hergebruiken, eenheden, versies, beperkte instructiecomponenten en expliciete bevestiging van afboekingen en boodschappenexports.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    () => tool(getCtx, async () => agentGuide),
  )

  return server
}
