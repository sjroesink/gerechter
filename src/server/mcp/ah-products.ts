import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { searchAhProducts, searchAhProductsInput } from '~/domain/ah-product-search'
import { linkAhProduct, linkAhProductInput, unlinkAhProduct } from '~/domain/ah-products'
import type { Ctx } from '~/domain/core'
import type { ShoppingDeps } from '~/domain/shopping-target'
import { tool } from './context-tool'

export function registerAhProductTools(server: McpServer, getCtx: () => Promise<Ctx>, deps: ShoppingDeps) {
  server.registerTool(
    'search_ah_products',
    {
      title: 'AH-producten zoeken',
      description:
        'Zoek read-only in het Albert Heijn-assortiment via de AH-verbinding van het actieve huishouden. Geef ingredientId mee voor suggestedPackAmount: de verpakkingsinhoud in de basiseenheid van dat ingrediënt, of null als die niet eenduidig uit de AH-inhoud volgt. Wijzigt niets aan de AH-lijst.',
      inputSchema: searchAhProductsInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    (input) => tool(getCtx, (ctx) => searchAhProducts(ctx, input, deps)),
  )
  server.registerTool(
    'link_ingredient_ah_product',
    {
      title: 'Ingrediënt aan AH-product koppelen',
      description:
        'Koppel een zichtbaar ingrediënt voor het actieve huishouden aan één AH-product (vervangt een bestaande koppeling). Gebruik id, title, unitSize en imageUrl uit search_ah_products. packAmount is de inhoud per verpakking in de basiseenheid van het ingrediënt; gebruik suggestedPackAmount of laat null als die onzeker is (dan wordt altijd 1 stuk met controle geëxporteerd). Kies alleen een product dat de gebruiker bedoelt.',
      inputSchema: linkAhProductInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    (input) => tool(getCtx, (ctx) => linkAhProduct(ctx, input)),
  )
  server.registerTool(
    'unlink_ingredient_ah_product',
    {
      title: 'AH-productkoppeling verwijderen',
      description:
        'Verwijder de AH-productkoppeling van een ingrediënt voor het actieve huishouden. Een AH-export zet het daarna weer als tekstregel op de lijst.',
      inputSchema: z.object({ ingredientId: z.string().min(1).max(100) }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    ({ ingredientId }) => tool(getCtx, (ctx) => unlinkAhProduct(ctx, ingredientId)),
  )
}
