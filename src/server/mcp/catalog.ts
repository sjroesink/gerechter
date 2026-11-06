import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { Ctx } from '~/domain/core'
import {
  createIngredient,
  createIngredientInput,
  getIngredient,
  removeIngredientConversion,
  searchIngredients,
  searchIngredientsInput,
  setIngredientArchived,
  setIngredientConversion,
  conversionInput,
  updateIngredient,
  updateIngredientInput,
} from '~/domain/catalog'
import { UNIT_IDS, UNITS } from '~/domain/units'
import { tool } from './context-tool'

const id = z.string().min(1).max(100)

export function registerCatalogTools(server: McpServer, getCtx: () => Promise<Ctx>) {
  server.registerTool(
    'list_units',
    {
      title: 'Eenheden',
      description:
        'De vaste eenheden met dimensies en standaardfactoren. Een snuf, handje of scheut heeft nooit een exacte omrekening.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    () => tool(getCtx, async () => UNITS),
  )
  server.registerTool(
    'search_ingredients',
    {
      title: 'Ingrediënten zoeken',
      description:
        'Zoek op naam of alias in de globale catalogus en je actieve huishouden. Zoek altijd eerst kandidaten en hergebruik een passend ingrediënt voordat je een nieuw ingrediënt maakt.',
      inputSchema: searchIngredientsInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tool(getCtx, (ctx) => searchIngredients(ctx, input)),
  )
  server.registerTool(
    'get_ingredient',
    {
      title: 'Ingrediënt bekijken',
      description:
        'Lees een zichtbaar ingrediënt met basiseenheid, aliassen, herkomst, optionele foto met bronvermelding en omrekeningen.',
      inputSchema: z.object({ ingredientId: id }),
      annotations: { readOnlyHint: true },
    },
    ({ ingredientId }) => tool(getCtx, (ctx) => getIngredient(ctx, ingredientId)),
  )
  server.registerTool(
    'create_ingredient',
    {
      title: 'Ingrediënt toevoegen',
      description:
        'Voeg alleen een ingrediënt toe als search_ingredients geen passende kandidaat heeft opgeleverd. Standaard eigen huishouden; globaal vereist platformbeheer. De basiseenheid staat daarna vast.',
      inputSchema: createIngredientInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) => tool(getCtx, (ctx) => createIngredient(ctx, input)),
  )
  server.registerTool(
    'update_ingredient',
    {
      title: 'Ingrediënt wijzigen',
      description:
        'Wijzig naam, aliassen en optioneel photo: {url, sourceUrl, credit, licenseUrl}. Photo weglaten behoudt de afbeelding; null wist haar. Gebruik alleen een gecontroleerde passende foto en bewaar de bron/voorwaarden. Herkomst en basiseenheid blijven behouden. Globale wijzigingen vereisen platformbeheer.',
      inputSchema: updateIngredientInput.extend({ ingredientId: id }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ ingredientId, ...input }) => tool(getCtx, (ctx) => updateIngredient(ctx, ingredientId, input)),
  )
  server.registerTool(
    'set_ingredient_archived',
    {
      title: 'Ingrediënt archiveren of herstellen',
      description: 'Archiveer een ingrediënt of herstel het. Bestaande verwijzingen blijven geldig.',
      inputSchema: z.object({ ingredientId: id, archived: z.boolean() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ ingredientId, archived }) => tool(getCtx, (ctx) => setIngredientArchived(ctx, ingredientId, archived)),
  )
  server.registerTool(
    'set_ingredient_conversion',
    {
      title: 'Omrekening vastleggen',
      description:
        'Leg vast hoeveel één broneenheid in de basiseenheid van dit ingrediënt is. Bijvoorbeeld 1 blik = 400 gram. Gebruik alleen bekende verhoudingen; vage eenheden zijn niet exact.',
      inputSchema: conversionInput.extend({ ingredientId: id }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ ingredientId, ...input }) => tool(getCtx, (ctx) => setIngredientConversion(ctx, ingredientId, input)),
  )
  server.registerTool(
    'remove_ingredient_conversion',
    {
      title: 'Omrekening verwijderen',
      description:
        'Verwijder een handmatige omrekening van een beheerd ingrediënt. Onbekende verhoudingen worden daarna niet meer gebruikt.',
      inputSchema: z.object({ ingredientId: id, unit: z.enum(UNIT_IDS) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ ingredientId, unit }) => tool(getCtx, (ctx) => removeIngredientConversion(ctx, ingredientId, unit)),
  )
}
