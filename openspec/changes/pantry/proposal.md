# Proposal

## Why

De catalogus en recepten zijn beschikbaar, maar huishoudens kunnen nog niet bijhouden wat ze in huis hebben. Voorraad en standaardporties zijn nodig voor planning, de gemaakt-flow en boodschappenberekeningen.

## What Changes

- Een huishoudspecifieke overlay met exacte voorraad in de basiseenheid en basisvoorraad als expliciete ‘altijd in huis’-keuze.
- Toevoegen, tellen, corrigeren en verwijderen met versiecontrole en een herleidbare mutatiehistorie.
- Huishoudinstelling voor standaardporties, met behoud van bestaande accounts en gegevens.
- Mobiele voorraadinterface en MCP-tools met dezelfde validatie en huishoudafscherming.

## Capabilities

### New Capabilities

- `household-pantry`: exacte voorraad, basisvoorraad en mutaties binnen het actieve huishouden.
- `household-preferences`: standaardporties voor planning en receptweergave.

### Modified Capabilities

Geen. Er zijn nog geen hoofd-specs; foundation en catalog zijn afgeronde changes.

## Impact

Additieve Drizzle-migratie, domeinfuncties, voorraad- en huishoudpagina, MCP-registratie en tests. Geen externe provider of nieuwe dependency. De toekomstige cooking- en shopping-changes gebruiken deze voorraad als bron.
