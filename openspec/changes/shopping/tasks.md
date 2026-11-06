# Tasks

## 1. Behoefteberekening

- [x] 1.1 Implementeer gerecht/dag/weekbehoefte met porties, aggregatie, voorraad, basisvoorraad en onbekende regels; test gedeelde ingrediënten, gemaakte/vrije items, archivering, actuele fingerprints en huishoudafscherming.

## 2. Exportopslag en providers

- [x] 2.1 Voeg verbindingen, SyncRuns en bronclaims met migratie toe; test databaseconstraints en versleuteling inclusief verkeerd huishouden, verkeerde sleutel en gemanipuleerde ciphertext.
- [x] 2.2 Implementeer verbindingbeheer, reserveren, bronoverlap, herhaalkeuze, share-resultaten en runhistorie; test rollen, gelijktijdige verzoeken, gewijzigde broninhoud en volledige afscherming.
- [x] 2.3 Implementeer ShoppingTarget en echte Notion-HTTP-provider met limietcontrole en read-only herstel; test verzoekvormen, paginering, 4xx, time-outs, 503 en onzekere resultaten zonder dubbele writes.

## 3. Interface en MCP

- [x] 3.1 Bouw mobiele behoefte- en exportflow, verbindinginstellingen en runhistorie met kopieer/deelfallback; verifieer gerecht/dag/week, overlap, annulering en 44×44-doelen op 360 px met Playwright.
- [x] 3.2 Voeg behoefte-, export-, status- en historietools via MCP toe; test de echte OAuth-handler op actuele broncontrole, herhaalveiligheid, overlap en afscherming zonder geheime velden.
- [x] 3.3 Documenteer behoefte, Delen, Notion-inrichting, historie en onzekere resultaten in README; controleer beschreven acties en onderscheid contracttests van eventuele live providercontrole.

## 4. Integratie

- [x] 4.1 Draai lint, typecheck en alle unit-, integratie- en browsertests, pas de migratie lokaal toe en controleer de nieuwe tools via de aangemelde MCP-client; rapporteer expliciet of een live Notion-verbinding beschikbaar is.

## Workflow follow-up

- Archiveer na review met synchronisatie naar de hoofd-specs.
