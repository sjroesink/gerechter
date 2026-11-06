# Proposal

## Why

Gerechter heeft accounts en huishoudens, maar nog geen ingrediëntencatalogus. Gerechten en MCP-agents hebben gedeelde ingrediënten, huishoudspecifieke aanvullingen en eenduidige hoeveelheden nodig voordat recepten bruikbaar kunnen worden opgeslagen.

## What Changes

- Een globale catalogus beheerd door de platformbeheerder, aangevuld met ingrediënten van het actieve huishouden.
- Zoeken op naam en aliassen met PostgreSQL `pg_trgm`, inclusief duidelijke vermelding van de herkomst.
- Een vaste eenhedenlijst met dimensies en veilige omrekeningen naar de basiseenheid van een ingrediënt.
- Ingrediëntspecifieke omrekeningen voor bijvoorbeeld een blik tomaten of de massa van een milliliter olie.
- Een mobiele cataloguspagina voor zoeken, aanmaken, wijzigen en archiveren, bereikbaar via Meer en Beheer.
- MCP-tools voor dezelfde catalogusacties, met dezelfde rechten en huishoudafscherming.

## Capabilities

### New Capabilities

- `ingredient-catalog`: globale en eigen ingrediënten, aliassen, zoeken, beheer en archivering.
- `measurement-units`: vaste dimensies, basiseenheden en ingrediëntspecifieke omrekeningen zonder ontbrekende of vage hoeveelheden te raden.

### Modified Capabilities

Geen. De bestaande auth- en navigatiestructuur blijven de basis voor de nieuwe routes en tools.

## Impact

Nieuwe Drizzle-tabellen en migratie, domeinmodules, server functions, MCP-registraties, cataloguspagina's en afschermings- en browsertests. De conventies uit `foundation/design.md` blijven gelden. De daadwerkelijke voorraad, gerechten en planning volgen in hun eigen changes.
