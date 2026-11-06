# Proposal

## Why

Een geplande of opgeslagen maaltijd is nog geen geregistreerde bereiding. Huishoudens moeten expliciet kunnen vastleggen wat ze hebben gemaakt, het persoonlijk beoordelen en gecontroleerd de werkelijk gebruikte voorraad afboeken.

## What Changes

- ‘Gemaakt registreren’ vanuit een recept of geplande maaltijd, met datum en daadwerkelijk gemaakte porties.
- Een vooraf getoonde afboeklijst met voorraad, exacte behoefte en aanpasbare hoeveelheden; ontbrekende/vage omrekeningen krijgen geen automatische afboeking.
- Atomaire opslag van bereiding, eventuele eigen beoordeling en bevestigde voorraadmutaties, met bescherming tegen dubbel versturen en verouderde gegevens.
- Geschiedenis met een receptmomentopname en persoonlijke beoordelingen per lid per bereiding.
- Mobiele UI en MCP-tools met dezelfde huishoudafscherming.

## Capabilities

### New Capabilities

- `cooking-history`: expliciete bereidingen, bevestigde voorraadmutaties en persoonlijke beoordelingen per bereiding.

### Modified Capabilities

Geen. Voorraad, recepten en planning zijn beschikbaar in afgeronde changes.

## Impact

Nieuwe tabellen en additieve migratie, transactionele domeinfuncties, voorraadmutatieverwijzingen, recepten/planning/geschiedenisroutes en MCP-tools. Geen externe provider of nieuwe dependency. Bestaande voorraadcorrecties blijven beschikbaar om een telling later te herstellen.
