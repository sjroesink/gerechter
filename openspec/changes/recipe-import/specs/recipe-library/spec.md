# Spec Delta

## Purpose

Bewaar gerechtfoto's als eigen kopie, met de originele URL als verwijzing.

## ADDED Requirements

### Requirement: Eigen kopie van de gerechtfoto
Bij het opslaan van een gerecht met een nieuwe of gewijzigde foto-URL SHALL het systeem de afbeelding downloaden en als eigen kopie in het huishouden bewaren. De foto-URL SHALL als verwijzing naar het origineel bewaard blijven. Een gewiste of vervangen foto-URL SHALL de vorige eigen kopie verwijderen.

#### Scenario: Geïmporteerde foto
- **WHEN** een gerecht wordt opgeslagen met een bereikbare foto-URL
- **THEN** toont de app de eigen kopie, ook als de bronsite de afbeelding later weigert of verwijdert

#### Scenario: Foto gewist
- **WHEN** een gerecht wordt opgeslagen zonder foto-URL
- **THEN** wordt de eerdere eigen kopie verwijderd

### Requirement: Alleen veilige afbeeldingen
Het systeem SHALL alleen JPEG, PNG, WebP, GIF en AVIF als eigen kopie accepteren, gecontroleerd op de inhoud en niet op de opgegeven header.

#### Scenario: Geen afbeelding
- **WHEN** de foto-URL een HTML-pagina of SVG oplevert
- **THEN** wordt er geen kopie bewaard

### Requirement: Opslaan ondanks een mislukte download
Mislukt het downloaden van de foto, dan SHALL het gerecht toch worden opgeslagen met een waarschuwing en SHALL de app de originele URL tonen.

#### Scenario: Download mislukt
- **WHEN** de foto niet te downloaden is of geen geldige afbeelding is
- **THEN** wordt het gerecht opgeslagen, krijgt de aanroeper een waarschuwing en toont de app de originele URL

### Requirement: Afgeschermde afbeeldingen
Het systeem SHALL een eigen kopie alleen leveren aan aangemelde leden van het huishouden waartoe de afbeelding behoort. Anderen SHALL een niet-gevonden antwoord krijgen.

#### Scenario: Lid van een ander huishouden
- **WHEN** een gebruiker de afbeelding van een ander huishouden opvraagt
- **THEN** volgt niet-gevonden en wordt er niets geleverd
