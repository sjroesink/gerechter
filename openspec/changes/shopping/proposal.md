# Proposal

## Why

Recepten, voorraad, planning en bereidingen zijn beschikbaar, maar huishoudens kunnen nog geen gezamenlijke boodschappenbehoefte afleiden of versturen. Berekening en verzenden moeten gescheiden zijn, zodat ontbrekende omrekeningen zichtbaar blijven en herhaald klikken geen stille dubbele export oplevert.

## What Changes

- Behoefte per gerecht, geplande dag of week, met geschaalde ingrediënten, eenmalige voorraadaftrek en basisvoorraaduitsluiting.
- Onbekende/vage hoeveelheden als expliciete controlepunten, zonder verzonnen omrekeningen; vrije en al gemaakte geplande items tellen niet opnieuw mee.
- Een gedeelde ShoppingTarget-interface met Delen/kopiëren en een echte Notion-provider die een checklistpagina aanmaakt.
- Huishoudspecifieke, versleuteld opgeslagen Notion-instellingen en een zichtbare SyncRun-historie met bronverwijzingen, inhoud en resultaat.
- Herhaalveilige verzending, overlapcontrole tussen dag/week/gerecht en een expliciete keuze voor bewust opnieuw exporteren. Onzekere externe resultaten worden gecontroleerd vóór een nieuwe verzending.
- Mobiele UI en MCP-tools met dezelfde afscherming en broncontrole.

## Capabilities

### New Capabilities

- `shopping-requirements`: behoefte uit gerechten en planning met voorraad, basisvoorraad en zichtbare onzekerheden.
- `shopping-sync`: deel- en Notion-export, instellingen, herhaalveiligheid en SyncRun-historie.

### Modified Capabilities

Geen. De afgeronde changes leveren de brongegevens.

## Impact

Additieve tabellen en migratie voor verbindingen, runs en bronclaims; domeinberekening, providerinterface, Notion-HTTP-client, versleuteling, UI en MCP. Notion gebruikt de gecontroleerde officiële API-versie 2026-03-11. Een live export vereist een door de huishoudeigenaar ingestelde verbinding. De experimentele AH-provider volgt in ah-sidecar met dezelfde interface.
