# Spec Delta

## Purpose

Biedt een herbruikbare ingrediëntencatalogus voor gerechten en voorraad, met gedeelde gegevens en afgeschermde aanvullingen per huishouden.

## ADDED Requirements

### Requirement: Globale en eigen ingrediënten
Het systeem SHALL de globale ingrediënten en de ingrediënten van het actieve huishouden tonen, inclusief naam, aliassen, basiseenheid en herkomst. Een ingrediënt van een ander huishouden SHALL als niet-bestaand worden behandeld, ook voor platformbeheerders.

#### Scenario: Catalogus bekijken
- **WHEN** een lid de catalogus opent
- **THEN** ziet die globale ingrediënten en eigen ingrediënten, met onderscheid tussen beide

#### Scenario: Aangepast ingrediënt-ID
- **WHEN** een gebruiker een ingrediënt van een ander huishouden opvraagt of wijzigt
- **THEN** volgt niet-gevonden en verandert er niets

### Requirement: Catalogus beheren
Het systeem SHALL alle leden eigen ingrediënten laten aanmaken en wijzigen. Alleen platformbeheerders SHALL globale ingrediënten kunnen aanmaken of wijzigen. Een naam is verplicht en dubbelingen van dezelfde genormaliseerde naam binnen dezelfde herkomst SHALL worden geweigerd.

#### Scenario: Lid maakt eigen ingrediënt
- **WHEN** een lid een naam, aliassen en basiseenheid opslaat als eigen ingrediënt
- **THEN** is dat ingrediënt beschikbaar in het actieve huishouden en blijft het daarbuiten onzichtbaar

#### Scenario: Globaal beheer
- **WHEN** een gewone gebruiker een globaal ingrediënt probeert te wijzigen of aan te maken
- **THEN** weigert het systeem de actie

#### Scenario: Dubbele naam
- **WHEN** een ingrediënt met dezelfde naam maar afwijkend hoofdlettergebruik of overtollige spaties binnen dezelfde herkomst wordt aangemaakt
- **THEN** weigert het systeem de dubbeling met een begrijpelijke melding

### Requirement: Zoeken op namen en aliassen
Het systeem SHALL de zichtbare catalogus op naam en aliassen doorzoeken, hoofdletterongevoelig en met ondersteuning voor kleine schrijffouten. Exacte treffers SHALL boven benaderende treffers staan. Alleen actieve ingrediënten SHALL standaard als kandidaten worden aangeboden.

#### Scenario: Alias en schrijffout
- **WHEN** een gebruiker zoekt op een alias of een kleine schrijffout in een naam
- **THEN** bevat het resultaat het bijbehorende zichtbare ingrediënt

### Requirement: Archiveren met behoud van verwijzingen
Het systeem SHALL ingrediënten archiveren in plaats van verwijderen. Gearchiveerde ingrediënten blijven via bestaande verwijzingen opvraagbaar en kunnen worden hersteld. Hun basiseenheid SHALL na aanmaak onveranderlijk zijn zodat opgeslagen hoeveelheden hun betekenis behouden.

#### Scenario: Archiveren en herstellen
- **WHEN** een bevoegde gebruiker een ingrediënt archiveert
- **THEN** verdwijnt het uit de standaardzoekresultaten, blijft het via het ID leesbaar en kan het worden hersteld

### Requirement: Mobiele catalogus en MCP-toegang
Het systeem SHALL dezelfde catalogusacties aanbieden via een mobiele pagina en MCP-tools, met dezelfde rechten en gegevensafscherming. De interface SHALL vanaf 360 pixels zonder horizontaal scrollen bruikbaar zijn, met aanraakdoelen van minstens 44×44 pixels.

#### Scenario: Agent zoekt voordat die toevoegt
- **WHEN** een agent de catalogustools opvraagt
- **THEN** bieden die zoeken, lezen en beheer aan en instrueren ze de agent bestaande kandidaten te gebruiken voordat een nieuw ingrediënt wordt gemaakt
