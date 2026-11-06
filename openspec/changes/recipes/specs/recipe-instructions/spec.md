# Spec Delta

## Purpose

Maakt bereidingsinstructies leesbaar en interactief binnen vaste receptsecties, zonder de echte ingrediëntenlijst te vervangen of ongecontroleerde gegenereerde inhoud uit te voeren.

## ADDED Requirements

### Requirement: Vaste instructiesecties
Het systeem SHALL de secties Voorbereiding, Bereiding, Serveren en Notities aanbieden. Elke sectie bevat leesbare tekst en optioneel een ondersteund OpenUI-blok. Dubbele of onbekende secties SHALL worden geweigerd. De secties SHALL steeds in de vaste volgorde worden getoond.

#### Scenario: Handmatige instructies
- **WHEN** een gebruiker tekst voor de bereidingssectie opslaat
- **THEN** staat die tekst onder Bereiding op de receptpagina

### Requirement: Ingrediënten zijn afgeleid
Het systeem SHALL de ingrediëntensectie uitsluitend uit de opgeslagen receptregels en de gekozen porties afleiden. Het SHALL geen gegenereerde ingrediëntensectie als vervanging accepteren.

#### Scenario: Gegenereerde ingrediëntenlijst
- **WHEN** een agent een onbekende sectie of een OpenUI-component voor een ingrediëntenlijst toevoegt
- **THEN** weigert het systeem die invoer en blijft de afgeleide ingrediëntenlijst leidend

### Requirement: Beperkte OpenUI-bibliotheek
Het systeem SHALL uitsluitend een instructiecontainer met tekststappen, tips, kookwekkers en checklists accepteren. Het SHALL complete invoer valideren vóór opslag. Onbekende componenten, ongeldige eigenschappen, onopgeloste verwijzingen, dynamische expressies, externe acties en toolaanroepen SHALL worden geweigerd.

#### Scenario: Geldig blok
- **WHEN** een agent een compleet OpenUI-blok met een tekststap en kookwekker toevoegt
- **THEN** toont de receptpagina die componenten binnen de gekozen sectie

#### Scenario: Ongeldige of externe actie
- **WHEN** een blok een onbekende component of een externe actie bevat
- **THEN** weigert het systeem de opslag met een begrijpelijke foutmelding

### Requirement: Veilige lokale interactie
Het systeem SHALL tekst als tekst weergeven. Checklists en kookwekkers SHALL lokaal bedienbaar zijn zonder servermutaties of externe aanroepen. Een kookwekker SHALL gestart, gepauzeerd en hersteld kunnen worden. OpenUI-inhoud SHALL de omringende receptpagina en gegevensafscherming niet kunnen wijzigen.

#### Scenario: Kookwekker en checklist
- **WHEN** een gebruiker een kookwekker start, pauzeert of herstelt, of een checklist aanvinkt
- **THEN** verandert alleen de lokale weergave en blijft het opgeslagen recept ongewijzigd

### Requirement: Componentdocumentatie voor agents
Het systeem SHALL via MCP de secties, toegestane componenten, eigenschappen en een geldig voorbeeld beschikbaar maken, zodat agents recepten kunnen maken zonder componenten of regels te raden.

#### Scenario: Agent vraagt instructieformaat
- **WHEN** een agent de instructiedocumentatie opvraagt
- **THEN** krijgt die de vaste secties, componentbeschrijvingen en een geldig voorbeeld terug
