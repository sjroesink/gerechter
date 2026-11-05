# Spec Delta

## Purpose

Biedt AI-agents een beveiligde MCP-toegang tot Gerechter, waarbij elke aanroep wordt uitgevoerd namens een echte gebruiker binnen diens huishouden, met dezelfde regels als de app.

## ADDED Requirements

### Requirement: MCP-endpoint via Streamable HTTP
Het systeem SHALL een MCP-server aanbieden op het pad `/mcp` via het Streamable HTTP-transport, zodat MCP-clients zoals Claude Code en Claude Desktop ermee kunnen verbinden.

#### Scenario: Client verbindt
- **WHEN** een geautoriseerde MCP-client verbindt met `/mcp` en de beschikbare tools opvraagt
- **THEN** krijgt de client de lijst met tools terug, waaronder `whoami`

### Requirement: OAuth-autorisatie verplicht
Het systeem SHALL elke MCP-aanroep zonder geldig toegangstoken weigeren met een autorisatie-uitdaging volgens de MCP-autorisatiespecificatie, zodat de client de OAuth-flow kan starten.

#### Scenario: Aanroep zonder token
- **WHEN** een client `/mcp` aanroept zonder toegangstoken
- **THEN** antwoordt het systeem met status 401 en een `WWW-Authenticate`-header die naar de metadata van de beschermde resource verwijst

#### Scenario: Ongeldig of verlopen token
- **WHEN** een client `/mcp` aanroept met een ongeldig of verlopen token
- **THEN** antwoordt het systeem met status 401 en voert het geen tool uit

### Requirement: Gebruiker geeft toestemming aan een agent
Het systeem SHALL tijdens de OAuth-flow de gebruiker laten inloggen (als dat nog niet zo is) en een toestemmingsscherm tonen waarop de gebruiker de client toegang geeft of weigert.

#### Scenario: Toestemming verleend
- **WHEN** een gebruiker op het toestemmingsscherm toegang verleent aan een MCP-client
- **THEN** ontvangt de client een toegangstoken dat aan die gebruiker gekoppeld is

#### Scenario: Toestemming geweigerd
- **WHEN** een gebruiker op het toestemmingsscherm de toegang weigert
- **THEN** ontvangt de client geen toegangstoken

### Requirement: Aanroepen namens gebruiker en huishouden
Het systeem SHALL elke MCP-toolaanroep uitvoeren namens de gebruiker van het token, binnen het actieve huishouden van die gebruiker, met dezelfde rechten en afscherming als in de app.

#### Scenario: whoami
- **WHEN** een geautoriseerde client de tool `whoami` aanroept
- **THEN** krijgt de client de naam en het e-mailadres van de gebruiker terug, het actieve huishouden met de rol daarin, en de lijst van huishoudens waar de gebruiker lid van is

#### Scenario: Gebruiker niet meer lid
- **WHEN** een gebruiker uit zijn enige huishouden is verwijderd en zijn client daarna een tool aanroept
- **THEN** weigert het systeem de aanroep met een foutmelding dat er geen actief huishouden is

### Requirement: Toegang intrekken
Het systeem SHALL een gebruiker op zijn accountpagina de MCP-clients laten zien waaraan toegang is verleend, en die toegang laten intrekken.

#### Scenario: Client intrekken
- **WHEN** een gebruiker de toegang van een MCP-client intrekt
- **THEN** worden volgende aanroepen van die client met status 401 geweigerd
