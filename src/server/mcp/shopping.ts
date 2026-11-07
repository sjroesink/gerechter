import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { Ctx } from '~/domain/core'
import { shoppingSourceInput } from '~/domain/shopping-needs'
import {
  checkShoppingSync,
  confirmShoppingShare,
  getShoppingPreview,
  getShoppingTargets,
  getSyncRun,
  listSyncRuns,
  shareOutcomeInput,
  shoppingExportInput,
  startShoppingExport,
} from '~/domain/shopping-sync'
import type { ShoppingDeps } from '~/domain/shopping-target'
import { tool } from './context-tool'

export function registerShoppingTools(server: McpServer, getCtx: () => Promise<Ctx>, deps: ShoppingDeps) {
  const runId = z.object({ runId: z.string().min(1).max(100) }).strict()
  server.registerTool(
    'prepare_shopping',
    {
      title: 'Boodschappen voorbereiden',
      description:
        'Bereken behoefte voor kind=recipe met recipeId en optionele servings, of kind=day/week met date. Trekt voorraad eenmaal af en sluit basisvoorraad, vrije en gemaakte geplande items uit. Onbekende hoeveelheden blijven expliciete controlepunten. Geeft een requestId, fingerprint, canonieke source, verbindingstatus en eerdere overlappende exports. Dit verzendt niets.',
      inputSchema: shoppingSourceInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tool(getCtx, (ctx) => getShoppingPreview(ctx, input)),
  )
  server.registerTool(
    'get_shopping_targets',
    {
      title: 'Boodschappenverbindingen bekijken',
      description:
        'Lees ingestelde boodschappendoelen van het actieve huishouden zonder tokens. Alleen een eigenaar kan geheimen in de webinterface instellen.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    () => tool(getCtx, (ctx) => getShoppingTargets(ctx)),
  )
  server.registerTool(
    'start_shopping_export',
    {
      title: 'Boodschappenexport bevestigen',
      description:
        'Start alleen op expliciete opdracht om deze gecontroleerde lijst naar het gekozen doel te exporteren. Gebruik source, requestId en fingerprint uit prepare_shopping. skip (ingredientIds uit items) laat items die de gebruiker al in huis heeft bij deze export weg; alleen op aanwijzing van de gebruiker. share zet de tekst klaar; Notion maakt echt een checklistpagina. Bij netwerkherhaling exact dezelfde invoer gebruiken. Overlappende bronnen worden voor share/Notion geweigerd tenzij de gebruiker bewust opnieuw exporteren kiest (allowRepeat=true); controleer daar onzekere eerdere resultaten eerst. AH leest eerst de lijst en voegt alleen toe wat ontbreekt of te weinig is, dus herhalen naar AH mag zonder allowRepeat (niet tijdens een lopende AH-export). Nooit automatisch opnieuw versturen.',
      inputSchema: shoppingExportInput,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) => tool(getCtx, (ctx) => startShoppingExport(ctx, input, deps)),
  )
  server.registerTool(
    'confirm_shopping_share',
    {
      title: 'Deelresultaat vastleggen',
      description:
        'Bevestig alleen een werkelijk afgeronde eigen kopieer-/deelactie of annulering als copied/shared/cancelled. Niet gebruiken om aflevering bij een ontvanger te suggereren. Een klaargezette tekst op zichzelf is nog niet gedeeld.',
      inputSchema: shareOutcomeInput,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    (input) => tool(getCtx, (ctx) => confirmShoppingShare(ctx, input)),
  )
  server.registerTool(
    'list_shopping_exports',
    {
      title: 'Boodschappenexporthistorie',
      description:
        'Lees de laatste honderd exports van het actieve huishouden met bron, doel, tijd en status, zonder geheimen.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    () => tool(getCtx, (ctx) => listSyncRuns(ctx)),
  )
  server.registerTool(
    'get_shopping_export',
    {
      title: 'Boodschappenexport bekijken',
      description:
        'Lees de oorspronkelijke lijst, bronkeuze en huidige status van één eigen huishoudexport. Opgeslagen tekst kan opnieuw bekeken worden zonder een nieuwe verzending.',
      inputSchema: runId,
      annotations: { readOnlyHint: true },
    },
    ({ runId }) => tool(getCtx, (ctx) => getSyncRun(ctx, runId)),
  )
  server.registerTool(
    'check_shopping_export',
    {
      title: 'Extern exportresultaat controleren',
      description:
        'Controleer een onzekere of oudere nog lopende export met alleen leesaanvragen bij de oorspronkelijke provider. Kan een reeds gemaakte Notion-pagina terugvinden. Stuurt nooit opnieuw boodschappen naar het doel; alleen de lokale status wordt bijgewerkt.',
      inputSchema: runId,
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    ({ runId }) => tool(getCtx, (ctx) => checkShoppingSync(ctx, runId, deps)),
  )
}
