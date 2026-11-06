import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { Ctx } from '~/domain/core'
import {
  cookingSearchInput,
  getMadeEvent,
  myRatingInput,
  prepareCooking,
  prepareCookingInput,
  recordMade,
  recordMadeInput,
  searchCookingHistory,
  setMyMadeRating,
} from '~/domain/cooking'
import { tool } from './context-tool'

export function registerCookingTools(server: McpServer, getCtx: () => Promise<Ctx>) {
  server.registerTool(
    'prepare_cooking',
    {
      title: 'Gemaakt voorbereiden',
      description:
        'Lees een afboekvoorstel vóór een expliciete gemaakt-registratie. Geeft requestId, recept/planningversies en per ingrediënt voorraadversie, exacte behoefte en voorstel in basiseenheid. Vage/ontbrekende omrekeningen geven nul en uitleg. Dit schrijft niets. Bespreek de hoeveelheden met de gebruiker voordat je record_made aanroept.',
      inputSchema: prepareCookingInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tool(getCtx, (ctx) => prepareCooking(ctx, input)),
  )
  server.registerTool(
    'record_made',
    {
      title: 'Gemaakt bevestigen',
      description:
        'Registreer alleen na een expliciete opdracht om deze bereiding en afboeklijst te bevestigen. Gebruik prepare_cooking, behoud requestId en bronversies en stuur de bewust gekozen exacte basishoeveelheden met pantryVersion. Een nul boekt niets af. Onbekende/vage hoeveelheden nooit zelf exact maken. Slaat bereiding, optionele eigen beoordeling en voorraadmutaties atomair op. Herhaal bij netwerkfouten exact dezelfde invoer en requestId; een nieuw voorstel is nodig bij conflicten.',
      inputSchema: recordMadeInput,
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    (input) => tool(getCtx, (ctx) => recordMade(ctx, input)),
  )
  server.registerTool(
    'search_cooking_history',
    {
      title: 'Bereidingen zoeken',
      description:
        'Zoek opgeslagen bereidingen op oorspronkelijke receptnaam en optioneel recipeId, uitsluitend binnen het actieve huishouden.',
      inputSchema: cookingSearchInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tool(getCtx, (ctx) => searchCookingHistory(ctx, input)),
  )
  server.registerTool(
    'get_made_event',
    {
      title: 'Bereiding bekijken',
      description:
        'Lees een historische receptmomentopname, gemaakte porties, bevestigde afboekingen en persoonlijke beoordelingen van het actieve huishouden.',
      inputSchema: z.object({ eventId: z.string().min(1).max(100) }).strict(),
      annotations: { readOnlyHint: true },
    },
    ({ eventId }) => tool(getCtx, (ctx) => getMadeEvent(ctx, eventId)),
  )
  server.registerTool(
    'set_my_made_rating',
    {
      title: 'Mijn bereiding beoordelen',
      description:
        'Wijzig alleen de eigen beoordeling van deze bereiding: optioneel geheel cijfer 1–10 en notitie. score=null met lege note wist de eigen beoordeling. Andere leden en voorraad blijven ongewijzigd; er is geen schrijfbare userId.',
      inputSchema: myRatingInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    (input) => tool(getCtx, (ctx) => setMyMadeRating(ctx, input)),
  )
}
