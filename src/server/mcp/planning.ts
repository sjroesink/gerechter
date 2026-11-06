import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { Ctx } from '~/domain/core'
import {
  createPlannedMeal,
  getDayPlan,
  getPlannedMeal,
  getWeekPlan,
  planDateInput,
  plannedMealInput,
  plannedMealUpdateInput,
  removePlannedMeal,
  updatePlannedMeal,
} from '~/domain/planning'
import { tool } from './context-tool'

const id = z.string().min(1).max(100)
export function registerPlanningTools(server: McpServer, getCtx: () => Promise<Ctx>) {
  server.registerTool(
    'get_week_plan',
    {
      title: 'Weekplanning bekijken',
      description:
        'Lees maandag tot zondag rond de opgegeven kalenderdatum (YYYY-MM-DD), inclusief lege dagen. Alleen het actieve huishouden. Porties zonder overschrijving volgen de actuele huishoudstandaard.',
      inputSchema: planDateInput,
      annotations: { readOnlyHint: true },
    },
    ({ date }) => tool(getCtx, (ctx) => getWeekPlan(ctx, date)),
  )
  server.registerTool(
    'get_day_plan',
    {
      title: 'Dagplanning bekijken',
      description:
        'Lees alle gerechten en vrije items van één kalenderdag (YYYY-MM-DD) in het actieve huishouden.',
      inputSchema: planDateInput,
      annotations: { readOnlyHint: true },
    },
    ({ date }) => tool(getCtx, (ctx) => getDayPlan(ctx, date)),
  )
  server.registerTool(
    'get_planned_meal',
    {
      title: 'Geplande maaltijd bekijken',
      description:
        'Lees één geplande maaltijd met versie en eventuele receptinhoud geschaald naar de effectieve porties. Vrije items hebben geen ingrediënten.',
      inputSchema: z.object({ mealId: id }).strict(),
      annotations: { readOnlyHint: true },
    },
    ({ mealId }) => tool(getCtx, (ctx) => getPlannedMeal(ctx, mealId)),
  )
  server.registerTool(
    'create_planned_meal',
    {
      title: 'Maaltijd plannen',
      description:
        'Plan een zichtbaar actief gerecht (kind=recipe met recipeId) of vrije tekst (kind=free met title). Zoek eerst het gerecht en controleer de dag op duplicaten. servings=null gebruikt de huishoudstandaard. Een vrije tekst heeft geen porties of receptverwijzing.',
      inputSchema: plannedMealInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) => tool(getCtx, (ctx) => createPlannedMeal(ctx, input)),
  )
  server.registerTool(
    'update_planned_meal',
    {
      title: 'Geplande maaltijd wijzigen',
      description:
        'Lees eerst get_planned_meal. Stuur mealId en in input de volledige gewenste soort, datum, inhoud, notitie en actuele version. Een nieuwe datum verplaatst het item; een verouderde versie geeft een conflict.',
      inputSchema: z.object({ mealId: id, input: plannedMealUpdateInput }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ mealId, input }) => tool(getCtx, (ctx) => updatePlannedMeal(ctx, mealId, input)),
  )
  server.registerTool(
    'remove_planned_meal',
    {
      title: 'Geplande maaltijd verwijderen',
      description:
        'Verwijder een item uit de actieve planning met de teruggelezen version. Bestaande verwijzingen blijven bewaard. Alleen het actieve huishouden.',
      inputSchema: z.object({ mealId: id, version: z.number().int().positive() }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    ({ mealId, version }) => tool(getCtx, (ctx) => removePlannedMeal(ctx, mealId, version)),
  )
}
