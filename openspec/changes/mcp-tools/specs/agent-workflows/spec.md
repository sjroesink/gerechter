## Purpose

Laat aangemelde agents de volledige app namens een gebruiker bedienen met een expliciet actief huishouden en vindbare, consistente werkinstructies.

## ADDED Requirements

### Requirement: Eigen huishoudens en expliciete keuze
Een aangemelde agent SHALL uitsluitend huishoudens van de tokengebruiker kunnen opvragen en als actief kiezen. Een keuze MUST dezelfde bewaarde gebruikersvoorkeur wijzigen als de webapp. Een onbekend of vreemd huishouden MUST worden geweigerd zonder de huidige keuze te wijzigen.

#### Scenario: Wisselen en teruglezen
- **WHEN** een gebruiker met twee lidmaatschappen via MCP het andere huishouden kiest
- **THEN** tonen de volgende MCP-aanroep en een vernieuwde webpagina dat huishouden met de eigen rol

#### Scenario: Vreemd huishouden
- **WHEN** een agent een huishouden kiest waarvan de gebruiker geen lid is
- **THEN** krijgt hij een algemene niet-gevondenfout en blijft de bestaande keuze behouden

### Requirement: Actuele context bij iedere actie
Iedere inhoudelijke MCP-aanroep MUST het actuele lidmaatschap en actieve huishouden opnieuw bepalen. Een eerder gelezen ID MUST geen toegang geven tot privégegevens van een ander actief huishouden. Intrekken van een lidmaatschap MUST bij de volgende aanroep gelden.

#### Scenario: Oud gerecht-ID na wisselen
- **WHEN** een agent na een huishoudwissel een privé gerecht-ID van het vorige huishouden opvraagt
- **THEN** is dat gerecht niet gevonden in het nieuwe huishouden

#### Scenario: Lidmaatschap ingetrokken
- **WHEN** het gekozen lidmaatschap wordt ingetrokken
- **THEN** gebruikt de volgende aanroep uitsluitend een nog geldig eigen lidmaatschap of meldt zij dat er geen actief huishouden is

### Requirement: Vindbare werkwijzer
Een aangemelde agent SHALL een werkwijzer kunnen opvragen met alle inhoudelijke toolgroepen, zoeken en hergebruiken van IDs, eenheden zonder aannames, versieconflicten, expliciete bevestiging van afboekingen/exports en toegestane instructiecomponenten. Deze leesactie MUST geen huishoudgegevens of providergeheimen wijzigen of onthullen.

#### Scenario: Nieuwe agent
- **WHEN** een aangemelde agent de werkwijzer leest
- **THEN** vindt hij de voorbereiding en bevestiging voor koken en boodschappen, de instructieformaattool en de huishoudkeuzeregels
