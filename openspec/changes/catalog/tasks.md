# Tasks

## 1. Opslag en eenheden

- [x] 1.1 Voeg ingrediënten en omrekeningen toe aan het Drizzle-schema, genereer de migratie en controleer unieke namen en migraties tegen echte Postgres.
- [x] 1.2 Implementeer de vaste eenheden en omzetting naar basiseenheden, met tests voor massa, volume, ingrediëntfactoren, ontbrekende factoren, vage eenheden en ongeldige hoeveelheden.

## 2. Catalogusdomein

- [x] 2.1 Implementeer zoeken, lezen, aanmaken, wijzigen, archiveren en herstellen met domeinvalidatie; test aliassen, schrijffouten, dubbele namen, beheerdersrechten en huishoudafscherming.
- [x] 2.2 Implementeer beheer en gebruik van ingrediëntspecifieke omrekeningen; test toevoegen, vervangen, verwijderen en afscherming van omrekeningen.

## 3. Gebruikersinterface en MCP

- [x] 3.1 Bouw server functions en mobiele cataloguspagina's met links vanuit Meer en Beheer; controleer aanmaken, zoeken, wijzigen en omrekeningen met Playwright op 360 px.
- [x] 3.2 Registreer de catalogus- en eenhedentools in MCP; test geautoriseerd zoeken en schrijven, ongeldige invoer en afscherming via de MCP-handler.

## 4. Documentatie en integratie

- [x] 4.1 Documenteer catalogusbeheer, de eenheden en MCP-tools in README en verifieer dat de beschreven routes en tools beschikbaar zijn.
- [x] 4.2 Voer lint, typecheck, unit-/integratie- en browsertests uit, migreer de lokale database en controleer catalogusdiscovery met de echte aangemelde Codex-MCP-client.

## Workflow follow-up

- Archiveer na review, met synchronisatie van de nieuwe capabilities naar de hoofdspecificaties.
