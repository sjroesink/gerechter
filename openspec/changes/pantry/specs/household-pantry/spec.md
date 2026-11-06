## Purpose

Laat leden bijhouden welke ingrediënten hun huishouden exact op voorraad heeft en welke ingrediënten altijd in huis worden verondersteld, als betrouwbare bron voor koken en boodschappen.

## ADDED Requirements

### Requirement: Exacte voorraad en basisvoorraad
Het systeem SHALL voorraad per zichtbaar ingrediënt en huishouden bewaren in de vaste basiseenheid. Basisvoorraad SHALL een afzonderlijke keuze ‘altijd in huis’ zijn, zonder een verzonnen hoeveelheid. Beide waarden SHALL onafhankelijk te wijzigen zijn.

#### Scenario: Tellen en basisvoorraad
- **WHEN** een lid 1,5 kg rijst telt en basisvoorraad aanvinkt
- **THEN** bewaart het systeem 1500 gram en een afzonderlijke basisvoorraadmarkering voor uitsluitend dit huishouden

#### Scenario: Onbekende of vage omrekening
- **WHEN** een lid een snuf of een blik zonder bekende omrekening als exacte voorraad invoert
- **THEN** weigert het systeem de wijziging en blijft de eerdere voorraad gelijk

### Requirement: Versiecontrole en mutatiehistorie
Het systeem MUST tellingen en correcties atomair met versiecontrole uitvoeren. Hoeveelheden MUST eindig en niet negatief zijn. Elke geslaagde wijziging MUST de actor, reden, voor- en nawaarden en tijd bewaren. Verwijderen uit de lijst MUST de voorraad naar nul en basisvoorraad naar uit zetten met behoud van geschiedenis.

#### Scenario: Gelijktijdige tellingen
- **WHEN** twee leden dezelfde voorraadversie wijzigen
- **THEN** slaagt één wijziging en krijgt de andere een conflict zonder extra mutatie

#### Scenario: Voorraad verwijderen
- **WHEN** een lid een voorraadregel verwijdert
- **THEN** verdwijnt deze uit de actieve lijst en blijft de mutatiehistorie terugleesbaar

### Requirement: Zichtbare voorraadinterface en afscherming
Het systeem MUST voorraad en historie uitsluitend binnen het actieve huishouden tonen en wijzigen. UI en MCP SHALL dezelfde regels gebruiken. De mobiele interface SHALL op 360 px zonder horizontaal scrollen werken met aanraakdoelen van minimaal 44×44 px.

#### Scenario: Ander huishouden
- **WHEN** een lid een ingrediënt-ID of voorraadverzoek van een ander huishouden gebruikt
- **THEN** krijgt dit lid geen voorraadgegevens en kan het de andere voorraad niet wijzigen

#### Scenario: Gearchiveerd ingrediënt
- **WHEN** een ingrediënt met bestaande voorraad is gearchiveerd
- **THEN** blijven de voorraad, correctiemogelijkheden en historie bereikbaar met een archiefaanduiding
