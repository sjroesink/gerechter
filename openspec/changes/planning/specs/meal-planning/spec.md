## Purpose

Laat huishoudleden samen gerechten en vrije maaltijditems per dag plannen, met een overzichtelijke weekindeling en porties als bron voor bereiding en boodschappen.

## ADDED Requirements

### Requirement: Kalenderdagen en weekoverzicht
Het systeem SHALL een week van maandag tot en met zondag tonen voor een gekozen geldige kalenderdatum en een detail per dag bieden. Meerdere items op één dag SHALL toegestaan zijn. Datums MUST zonder verschuiving door tijdzones of zomertijd worden bewaard.

#### Scenario: Jaarwisseling en lege dagen
- **WHEN** een lid de week van 1 januari 2027 opent
- **THEN** toont het systeem 28 december 2026 tot en met 3 januari 2027, inclusief dagen zonder items

### Requirement: Gerechten en vrije items plannen
Het systeem SHALL leden een zichtbaar actief gerecht of een vrije tekst met datum en notitie laten plannen. Voor gerechten SHALL een optionele portie-overschrijving gelden; zonder overschrijving SHALL de actuele huishoudvoorkeur worden gebruikt. Vrije items MUST geen receptingrediënten of verzonnen hoeveelheden krijgen.

#### Scenario: Porties voor een gepland gerecht
- **WHEN** een recept voor 2 personen is gepland met een overschrijving naar 3
- **THEN** toont de planning 3 porties en schalen de afgeleide ingrediënten met factor 1,5 zonder het recept te wijzigen

#### Scenario: Vrije maaltijd
- **WHEN** een lid Restjes met een notitie toevoegt
- **THEN** verschijnt dit item op de gekozen dag zonder receptverwijzing of ingrediënten

### Requirement: Wijzigen verplaatsen verwijderen en archivering
Het systeem MUST planning versiegestuurd wijzigen en verwijderen. Een verouderde versie MUST een conflict geven zonder wijzigingen. Verwijderen SHALL een item uit de actieve planning halen met behoud van de referentie voor toekomstige geschiedenis. Een gearchiveerd recept SHALL in bestaande planning leesbaar blijven maar niet nieuw in te plannen zijn.

#### Scenario: Gelijktijdig wijzigen
- **WHEN** twee leden dezelfde geplande maaltijdversie wijzigen of verwijderen
- **THEN** slaagt één actie en krijgt de andere een conflict zonder overschrijving

#### Scenario: Verplaatsen en archiveren
- **WHEN** een gepland gerecht na archivering naar een andere dag wordt verplaatst
- **THEN** blijft de verwijzing behouden en toont het systeem dat het recept gearchiveerd is

### Requirement: Afgeschermde mobiele planning en MCP
Het systeem MUST planning uitsluitend in het actieve huishouden lezen en schrijven; aangepaste item- of recept-ID's MUST geen gegevens uit andere huishoudens blootleggen. UI en MCP SHALL dezelfde regels gebruiken. De UI SHALL op 360 px zonder horizontaal scrollen werken en doelen van minimaal 44×44 px hebben.

#### Scenario: Ander huishouden
- **WHEN** een agent of lid een item-ID uit een ander huishouden gebruikt
- **THEN** wordt het item als niet gevonden behandeld en blijft het ongewijzigd
