import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { Ctx } from '~/domain/core'
import {
  createRecipe,
  getRecipe,
  recipeInput,
  recipeSearchInput,
  recipeUpdateInput,
  searchRecipes,
  setRecipeArchived,
  updateRecipe,
} from '~/domain/recipes'
import { getInstructionFormat } from '~/domain/instructions'
import { tool } from './context-tool'
import { fetchRecipeFromUrl, fetchRecipeInput, type RecipeImportDeps } from '../recipe-import'

const id = z.string().min(1).max(100)
export function registerRecipeTools(
  server: McpServer,
  getCtx: () => Promise<Ctx>,
  recipeImport: RecipeImportDeps,
) {
  const recipeDeps = { fetchImage: recipeImport.fetchImage }
  server.registerTool(
    'get_instruction_format',
    {
      title: 'Instructieformaat',
      description:
        'Vaste receptsecties, toegestane OpenUI-componenten, eigenschappen, regels en een geldig voorbeeld. Vraag dit op voordat je interactieve instructieblokken maakt. De ingrediëntensectie komt altijd uit de echte receptregels.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    () => tool(getCtx, async () => getInstructionFormat()),
  )
  server.registerTool(
    'search_recipes',
    {
      title: 'Gerechten zoeken',
      description:
        'Zoek gerechten van het actieve huishouden op naam of tags. Hergebruik bestaande gerechten waar passend en controleer op bestaande voorbeelden voordat je opnieuw aanmaakt.',
      inputSchema: recipeSearchInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tool(getCtx, (ctx) => searchRecipes(ctx, input)),
  )
  server.registerTool(
    'get_recipe',
    {
      title: 'Gerecht bekijken',
      description:
        'Lees een gerecht met actuele versie, metadata, ingrediënten en vaste instructies. servings schaalt alleen de weergave; het opgeslagen recept blijft gelijk. Onbekende basishoeveelheden blijven null.',
      inputSchema: z.object({ recipeId: id, servings: z.number().int().min(1).max(1000).optional() }),
      annotations: { readOnlyHint: true },
    },
    ({ recipeId, servings }) => tool(getCtx, (ctx) => getRecipe(ctx, recipeId, servings)),
  )
  server.registerTool(
    'fetch_recipe_from_url',
    {
      title: 'Recept van URL uitlezen',
      description:
        'Haal een receptpagina op en lees die uit tot een concept (schema.org/Recipe): naam, beschrijving, porties, tijden, ruwe ingredientLines, steps, imageUrl, suggestedTags en de uiteindelijke sourceUrl. Slaat niets op. Bestaat er al een gerecht met deze bron, dan staat dat in existingRecipe: gebruik dat in plaats van een duplicaat. Zonder gestructureerde gegevens is structured false en staat de paginatekst in pageText. Importeren: zoek per regel het ingrediënt met search_ingredients (maak alleen nieuw aan als niets past), zet hoeveelheid en eenheid alleen om als die eenduidig zijn (anders quantity null en de originele tekst in note), verdeel de stappen over de vaste secties (get_instruction_format) en roep create_recipe aan met sourceUrl en photoUrl = imageUrl.',
      inputSchema: fetchRecipeInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (input) => tool(getCtx, (ctx) => fetchRecipeFromUrl(ctx, recipeImport, input)),
  )
  server.registerTool(
    'create_recipe',
    {
      title: 'Gerecht toevoegen',
      description:
        'Maak een gerecht in het actieve huishouden. Zoek eerst alle ingrediënten via search_ingredients en gebruik echte IDs. Vraag get_instruction_format op voor OpenUI. Onbekende hoeveelheden zijn null, nooit verzonnen omrekeningen. Een photoUrl wordt gedownload en als eigen kopie bewaard (imageUrl); photoUrl blijft de verwijzing naar het origineel. Lukt dat niet, dan wordt het gerecht toch opgeslagen en staat de reden in photoWarning.',
      inputSchema: recipeInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) => tool(getCtx, (ctx) => createRecipe(ctx, input, recipeDeps)),
  )
  server.registerTool(
    'update_recipe',
    {
      title: 'Gerecht wijzigen',
      description:
        'Vervang de volledige metadata, ingrediënten en instructies van een gerecht. Lees eerst get_recipe en stuur de actuele version en volledige gewenste inhoud mee. Een verouderde versie geeft een conflict; lees opnieuw en behoud andermans wijzigingen.',
      inputSchema: recipeUpdateInput.extend({ recipeId: id }),
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ recipeId, ...input }) => tool(getCtx, (ctx) => updateRecipe(ctx, recipeId, input, recipeDeps)),
  )
  server.registerTool(
    'set_recipe_archived',
    {
      title: 'Gerecht archiveren of herstellen',
      description:
        'Archiveer een gerecht zonder gegevens of verwijzingen te verwijderen, of herstel het. Altijd binnen het actieve huishouden.',
      inputSchema: z.object({ recipeId: id, archived: z.boolean() }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    ({ recipeId, archived }) => tool(getCtx, (ctx) => setRecipeArchived(ctx, recipeId, archived)),
  )
}
