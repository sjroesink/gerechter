# Tasks

## 1. Opslag en domein

- [x] 1.1 Voeg voorraad, mutatiehistorie en huishoudvoorkeuren met additieve migratie toe; verifieer migratie en constraints tegen Postgres.
- [x] 1.2 Implementeer exacte tellingen, basisvoorraad, verwijderen, historie en versiecontrole; test omrekeningen, conflicten, rollback, gearchiveerde ingrediënten en huishoudafscherming.
- [x] 1.3 Implementeer standaardporties en pas receptweergave aan; test geldige en ongeldige voorkeuren, huishoudafscherming en behoud van oorspronkelijke receptporties.

## 2. Interface en MCP

- [x] 2.1 Bouw de mobiele voorraadlijst, toevoegen, detailcorrectie, verwijderen en historie; verifieer de volledige flow en 44×44-doelen op 360 px met Playwright.
- [x] 2.2 Voeg standaardporties op de huishoudpagina toe; verifieer via Playwright dat nieuwe receptweergaven deze gebruiken en expliciete porties voorgaan.
- [x] 2.3 Registreer voorraad- en voorkeurtools via MCP; test de echte OAuth-handler op lezen, mutaties, conflicten en huishoudafscherming.
- [x] 2.4 Documenteer voorraad, basisvoorraad, historie, standaardporties en MCP-tools in README en controleer de beschreven acties.

## 3. Integratie

- [x] 3.1 Draai lint, typecheck en alle unit-, integratie- en browsertests, pas de migratie lokaal toe en controleer dat de aangemelde MCP-client de nieuwe tools ontdekt.

## Workflow follow-up

- Archiveer na review met synchronisatie naar de hoofd-specs.
