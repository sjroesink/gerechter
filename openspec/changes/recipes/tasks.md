# Tasks

## 1. Receptopslag en instructieformaat

- [x] 1.1 Voeg recept- en ingrediëntregeltabellen toe met huishoud-ID's, verwijzingen, versies en migratie; controleer migraties en databaseconstraints tegen Postgres.
- [x] 1.2 Implementeer vaste instructiesecties en de beperkte OpenUI-bibliotheek met volledige opslagvalidatie; test geldige blokken, onvolledigheid, onbekende componenten, dynamiek en externe acties.

## 2. Receptdomein

- [x] 2.1 Implementeer atomaire aanmaak en versiegestuurde wijzigingen met zichtbare ingrediëntverwijzingen en geldige metadata; test rollback, onzichtbare en gearchiveerde ingrediënten en conflicten.
- [x] 2.2 Implementeer zoeken op naam/tags, lezen en porties schalen, archiveren en herstellen; test onbekende/vage hoeveelheden en volledige huishoudafscherming.

## 3. Interface en MCP

- [x] 3.1 Bouw mobiele gerechtenlijst, detail en editor met ingrediënten, metadata, instructies en portiekeuze; controleer de CRUD-flow, archief en 44×44-doelen op 360 px met Playwright.
- [x] 3.2 Render toegestane OpenUI-blokken met lokale timer- en checklistinteractie; controleer dit met Playwright en verifieer dat de afgeleide ingrediëntensectie behouden blijft.
- [x] 3.3 Bied alle receptacties en instructieformaat via MCP aan; test de echte OAuth-handler op aanmaak, lezen, wijzigingen, ongeldige inhoud en huishoudafscherming.

## 4. Documentatie en integratie

- [x] 4.1 Documenteer receptbeheer, porties, archivering en het instructieformaat in README en controleer de beschreven routes en tools.
- [x] 4.2 Draai lint, typecheck en alle relevante tests, migreer de lokale database en maak drie voorbeeldgerechten via de echt aangemelde Codex-MCP-client; lees ze terug om opgeslagen inhoud en huishouden te controleren.

## Workflow follow-up

- Archiveer na review met synchronisatie naar de hoofdspecificaties.
