# Proposal

## Why

De inhoudelijke modules bieden al MCP-tools, maar een agent kan het actieve huishouden nog niet zelf wisselen. De laatste geplande change maakt de gezamenlijke gebruikerscontext expliciet en geeft agents één actuele werkwijzer voor de volledige app.

## What Changes

- `list_households` en `switch_household` voor uitsluitend eigen lidmaatschappen, met dezelfde bewaarde actieve keuze als de webapp.
- `get_agent_guide` met de bestaande toolgroepen, zoek-/hergebruikstrategie, eenheden, versies, bevestigingsflows en beperkte instructiecomponenten.
- Aanvullende OAuth-integratie- en browserverificatie van contextwissels, huishoudafscherming en ingetrokken lidmaatschappen.
- README en eindverificatie van de volledige geplande app, inclusief bestaande echte MCP-verbinding en voorbeeldgerechten.

## Capabilities

### New Capabilities

- `agent-workflows`: agentcontext, expliciete huishoudkeuze en vindbare werkinstructies voor inhoudelijke appacties.

### Modified Capabilities

Geen; de bestaande moduletools en hun domeinregels blijven van toepassing.

## Impact

MCP-adapters, een gedeelde werkwijzer, tests en documentatie. Geen nieuwe dependencies, databasetabellen of globale accountbeheeracties via MCP.
