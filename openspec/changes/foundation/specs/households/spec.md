# Spec Delta

## Purpose

Maakt het huishouden de eenheid waarbinnen planning, gerechten en voorraad gedeeld worden, regelt wie lid is en met welke rechten, en zorgt dat huishoudens elkaars gegevens nooit zien.

## ADDED Requirements

### Requirement: Lidmaatschap met rollen
Het systeem SHALL elke gebruiker lid laten zijn van één of meer huishoudens, met per huishouden de rol eigenaar of lid. Elk huishouden SHALL altijd minstens één eigenaar hebben.

#### Scenario: Ledenlijst bekijken
- **WHEN** een lid de huishoudpagina opent
- **THEN** ziet het lid de naam van het huishouden en alle leden met hun rol

#### Scenario: Laatste eigenaar
- **WHEN** de enige eigenaar van een huishouden probeert zijn eigen rol te verlagen of het huishouden te verlaten
- **THEN** weigert het systeem dit met de melding dat er eerst een andere eigenaar moet zijn

### Requirement: Leden uitnodigen via een link
Het systeem SHALL een eigenaar een uitnodigingslink voor zijn huishouden laten aanmaken die 7 dagen geldig is en één keer gebruikt kan worden. De link SHALL zonder e-mailserver te delen zijn (kopiëren of het deelmenu van het apparaat).

#### Scenario: Eigenaar maakt uitnodiging
- **WHEN** een eigenaar een uitnodiging aanmaakt
- **THEN** krijgt de eigenaar een link die gekopieerd of gedeeld kan worden, en staat de uitnodiging als openstaand in de ledenlijst

#### Scenario: Lid probeert uit te nodigen
- **WHEN** een gebruiker met de rol lid een uitnodiging probeert aan te maken
- **THEN** weigert het systeem de actie

#### Scenario: Uitnodiging intrekken
- **WHEN** een eigenaar een openstaande uitnodiging intrekt
- **THEN** is de link direct ongeldig

### Requirement: Bestaand account accepteert uitnodiging
Het systeem SHALL een ingelogde gebruiker met een bestaand account een huishouduitnodiging laten accepteren, waarna die lid wordt van dat huishouden naast zijn bestaande huishoudens.

#### Scenario: Ingelogd accepteren
- **WHEN** een ingelogde gebruiker een geldige uitnodigingslink opent en accepteert
- **THEN** wordt de gebruiker lid van het huishouden en wordt dat het actieve huishouden

### Requirement: Leden en rollen beheren
Het systeem SHALL een eigenaar de rol van leden laten wijzigen en leden uit het huishouden laten verwijderen. Een lid SHALL een huishouden zelf kunnen verlaten.

#### Scenario: Lid verwijderen
- **WHEN** een eigenaar een lid uit het huishouden verwijdert
- **THEN** heeft die gebruiker direct geen toegang meer tot de gegevens van dat huishouden, ook niet via MCP

#### Scenario: Lid promoveren
- **WHEN** een eigenaar een lid de rol eigenaar geeft
- **THEN** heeft die gebruiker de rechten van een eigenaar

### Requirement: Actief huishouden
Het systeem SHALL per gebruiker één actief huishouden bijhouden. Alle pagina's en acties werken binnen het actieve huishouden. Een gebruiker met meerdere huishoudens SHALL kunnen wisselen.

#### Scenario: Wisselen van huishouden
- **WHEN** een gebruiker met twee huishoudens wisselt naar het andere huishouden
- **THEN** tonen alle pagina's de gegevens van het gekozen huishouden, en blijft die keuze bewaard bij een volgende inlog

#### Scenario: Gebruiker met één huishouden
- **WHEN** een gebruiker lid is van precies één huishouden
- **THEN** toont de app geen wisselaar

### Requirement: Afscherming tussen huishoudens
Het systeem SHALL gegevens van een huishouden alleen tonen aan of laten wijzigen door leden van dat huishouden. Dit geldt voor de UI, MCP en elke toekomstige interface.

#### Scenario: Toegang tot een ander huishouden
- **WHEN** een gebruiker een gegeven opvraagt of wijzigt dat bij een huishouden hoort waar die geen lid van is, bijvoorbeeld via een aangepaste URL of MCP-aanroep
- **THEN** behandelt het systeem het gegeven als niet bestaand en wijzigt het niets
