# Tasks

## 1. Opslag en transactioneel domein

- [x] 1.1 Voeg bereidingen, momentopnamen, beoordelingen en afboekverwijzingen met additieve migratie toe; verifieer constraints en migratie tegen Postgres.
- [x] 1.2 Implementeer voorbereiding en atomaire, herhaalveilige bevestiging met aanpasbare afboekingen; test ontbrekende/vage conversies, dubbele regels, onvoldoende voorraad, bronconflicten, gelijktijdigheid en rollback.
- [x] 1.3 Implementeer geschiedenis en eigen beoordelingen; test blijvende momentopnamen, meerdere beoordelaars, wissen en volledige huishoudafscherming.

## 2. Interface en MCP

- [x] 2.1 Bouw gemaakt-flow vanuit recept en planning plus geschiedenis en beoordeling; test de volledige mobiele flow en 44×44-doelen op 360 px met Playwright.
- [x] 2.2 Voeg voorbereiding, bevestiging, geschiedenis en eigen beoordeling via MCP toe; test de echte OAuth-handler op mutaties, herhaalveiligheid en afscherming.
- [x] 2.3 Documenteer gemaakt registreren, afboekingen, momentopnamen, beoordelingen en MCP-tools in README en controleer de beschreven acties.

## 3. Integratie

- [x] 3.1 Draai lint, typecheck en alle unit-, integratie- en browsertests, pas de migratie lokaal toe en controleer de nieuwe tools via de aangemelde MCP-client.

## Workflow follow-up

- Archiveer na review met synchronisatie naar de hoofd-specs.
