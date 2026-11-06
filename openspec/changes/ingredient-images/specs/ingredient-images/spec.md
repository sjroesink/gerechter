## Purpose

Maakt ingrediënten visueel herkenbaar met een aanpasbare foto en herleidbare bron, zonder bestaande catalogusgegevens of huishoudafscherming te veranderen.

## ADDED Requirements

### Requirement: Afbeelding met herkomst beheren
Een ingrediënt SHALL een optionele HTTP(S)-afbeelding, bronpagina, credit en voorwaardenlink kunnen bewaren. Alleen wie het ingrediënt mag beheren SHALL die gegevens wijzigen of wissen. Ongeldige URLs MUST worden geweigerd. UI en MCP MUST dezelfde regels gebruiken.

#### Scenario: Eigen afbeelding opslaan
- **WHEN** een lid een geldige afbeelding bij een eigen ingrediënt opslaat
- **THEN** tonen leesacties de afbeelding en bron binnen dezelfde cataloguszichtbaarheid

#### Scenario: Globaal of vreemd ingrediënt
- **WHEN** een gebruiker zonder vereiste rechten een globale of vreemde privé-afbeelding wijzigt
- **THEN** weigert het systeem de wijziging volgens de bestaande catalogusrechten

### Requirement: Bestaande beelden behouden
Een wijziging die geen beeldgegevens meestuurt MUST de bestaande afbeelding behouden. Expliciet wissen SHALL mogelijk zijn. Een additieve uitrol MUST bestaande recepten, tellingen, planning, accounts en catalogusgegevens behouden.

#### Scenario: Oude agent wijzigt een naam
- **WHEN** een agent uitsluitend de naam en aliassen van een ingrediënt wijzigt
- **THEN** blijven de foto en haar brongegevens behouden

### Requirement: Herkenbare mobiele weergave
Catalogus, ingrediëntkiezer, voorraad, receptingrediënten en boodschappen SHALL het ingrediëntbeeld tonen waar beschikbaar. De ingrediëntpagina SHALL de opgeslagen bronvermelding en voorwaardenlinks aanbieden. Ontbrekende of niet-ladende foto's MUST de pagina bruikbaar laten. De interface MUST op 360 px passen met bestaande toegankelijke namen en aanraakdoelen.

#### Scenario: Afbeelding laadt niet
- **WHEN** een externe foto niet bereikbaar is
- **THEN** toont de interface een neutrale vervanging zonder kapot afbeeldingssymbool of foutpagina

#### Scenario: Afbeeldingen bij boodschappen
- **WHEN** een gebruiker boodschappen voor een dag, week of gerecht bekijkt
- **THEN** staan foto's bij te kopen ingrediënten, basisvoorraad en voldoende voorraad, zonder wijziging van hoeveelheden, exporttekst of inhoudsfingerprint

### Requirement: Gecontroleerde voorbeeldbeelden
Bestaande ingrediënten SHALL alleen een gecontroleerde passende bronafbeelding krijgen zonder een aanwezige foto te overschrijven. Een algemene bronfoto MUST niet als foto van een specifiek merkproduct worden voorgesteld. Receptinhoud en voorraad MUST door het koppelen ongewijzigd blijven.

#### Scenario: Ingrediënt met eigen foto
- **WHEN** voorbeeldafbeeldingen worden toegevoegd
- **THEN** blijft een bestaande eigen foto behouden en worden nieuwe bronverwijzingen teruggelezen
