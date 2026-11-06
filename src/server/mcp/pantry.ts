import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { Ctx } from '~/domain/core'
import {
  getPantryHistory,
  getPantryItem,
  listPantry,
  pantryRemoveInput,
  pantrySearchInput,
  pantrySetInput,
  removePantryItem,
  setPantryItem,
} from '~/domain/pantry'
import { getHouseholdPreferences, preferencesInput, setHouseholdPreferences } from '~/domain/preferences'
import { tool } from './context-tool'

const ingredientInput = z.object({ ingredientId: z.string().min(1).max(100) }).strict()
export function registerPantryTools(server: McpServer, getCtx: () => Promise<Ctx>) {
  server.registerTool(
    'get_pantry',
    {
      title: 'Voorraad bekijken',
      description:
        'Exacte voorraad en afzonderlijke basisvoorraad van het actieve huishouden. Hoeveelheden zijn in de basiseenheid. includeEmpty toont ook verwijderde/nulregels.',
      inputSchema: pantrySearchInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tool(getCtx, (ctx) => listPantry(ctx, input)),
  )
  server.registerTool(
    'get_pantry_item',
    {
      title: 'Voorraad van ingrediënt',
      description:
        'Lees de hoeveelheid, basisvoorraad en actuele version. Een nog niet getelde zichtbare regel heeft quantity=0 en version=0.',
      inputSchema: ingredientInput,
      annotations: { readOnlyHint: true },
    },
    ({ ingredientId }) => tool(getCtx, (ctx) => getPantryItem(ctx, ingredientId)),
  )
  server.registerTool(
    'set_pantry_item',
    {
      title: 'Voorraad tellen of corrigeren',
      description:
        'Stel de volledige exacte voorraad en basisvoorraad in met de teruggelezen version. Dit telt niet op. Zoek eerst het ingrediënt en lees get_pantry_item. Gebruik alleen bekende omrekeningen. staple betekent altijd in huis, onafhankelijk van de getelde hoeveelheid. Geef een duidelijke reden/notitie; bij conflict eerst opnieuw lezen.',
      inputSchema: pantrySetInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) => tool(getCtx, (ctx) => setPantryItem(ctx, input)),
  )
  server.registerTool(
    'remove_pantry_item',
    {
      title: 'Voorraadregel verwijderen',
      description:
        'Zet de exacte voorraad op nul en basisvoorraad uit met versiecontrole. De historie blijft bewaard. Gebruik alleen na een uitdrukkelijk gewenste verwijdering.',
      inputSchema: pantryRemoveInput,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    (input) => tool(getCtx, (ctx) => removePantryItem(ctx, input)),
  )
  server.registerTool(
    'get_pantry_history',
    {
      title: 'Voorraadmutaties bekijken',
      description:
        'Lees de laatste 100 tellingen, correcties en verwijderingen voor dit ingrediënt binnen het actieve huishouden, met actor, tijd, notitie en voor/na.',
      inputSchema: ingredientInput,
      annotations: { readOnlyHint: true },
    },
    ({ ingredientId }) => tool(getCtx, (ctx) => getPantryHistory(ctx, ingredientId)),
  )
  server.registerTool(
    'get_household_preferences',
    {
      title: 'Huishoudvoorkeuren bekijken',
      description:
        'Lees het standaard aantal porties van het actieve huishouden. Zonder ingestelde voorkeur is dit 2.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    () => tool(getCtx, (ctx) => getHouseholdPreferences(ctx)),
  )
  server.registerTool(
    'set_household_preferences',
    {
      title: 'Huishoudvoorkeuren wijzigen',
      description:
        'Stel standaardporties in voor het actieve huishouden (1–1000 personen). Dit wijzigt geen opgeslagen recept en geldt voor alle leden.',
      inputSchema: preferencesInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    (input) => tool(getCtx, (ctx) => setHouseholdPreferences(ctx, input)),
  )
}
