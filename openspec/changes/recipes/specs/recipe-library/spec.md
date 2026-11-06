# Spec Delta

## Purpose

Laat huishoudens hun gerechten duurzaam bewaren, terugvinden en aanpassen, met echte ingrediëntverwijzingen en hoeveelheden die meegroeien met het aantal porties.

## ADDED Requirements

### Requirement: Recepten per huishouden
Het systeem SHALL recepten uitsluitend binnen het actieve huishouden tonen en wijzigen. Een recept bevat een naam, beschrijving, aantal porties, optionele voorbereidingstijd, kooktijd, bron-URL, foto-URL en tags. Alle leden SHALL recepten kunnen beheren. Recepten van andere huishoudens SHALL als niet-bestaand worden behandeld.

#### Scenario: Recept toevoegen en teruglezen
- **WHEN** een lid een geldig recept opslaat
- **THEN** wordt het recept in het actieve huishouden gemaakt en kan een ander lid van dat huishouden het teruglezen

#### Scenario: Aangepast recept-ID
- **WHEN** een gebruiker een recept van een ander huishouden probeert te lezen, wijzigen of archiveren
- **THEN** volgt niet-gevonden en verandert er niets

### Requirement: Geldige metadata en ingrediënten
Het systeem SHALL een naam, positieve porties en minstens één ingrediëntregel vereisen. Regels bevatten een zichtbaar ingrediënt, een positieve hoeveelheid of een expliciet onbekende hoeveelheid, een bekende eenheid en optionele notitie. Alleen HTTP(S)-URL's SHALL als bron of foto worden geaccepteerd. Ongeldige invoer SHALL geen gedeeltelijk recept achterlaten.

#### Scenario: Onzichtbaar ingrediënt
- **WHEN** een recept een ingrediënt van een ander huishouden bevat
- **THEN** weigert het systeem het volledige opslaan zonder gedeeltelijke wijzigingen

#### Scenario: Gearchiveerd ingrediënt
- **WHEN** een nieuw recept een gearchiveerd ingrediënt bevat
- **THEN** weigert het systeem dit, terwijl bestaande verwijzingen in eerder opgeslagen recepten leesbaar en bewerkbaar blijven

### Requirement: Porties schalen
Het systeem SHALL ingrediënthoeveelheden lineair schalen naar een gekozen positief aantal porties zonder het opgeslagen recept te wijzigen. Het SHALL bekende basishoeveelheden berekenen met de catalogusverhoudingen. Onbekende en vage hoeveelheden SHALL expliciet onbekend blijven voor exacte berekeningen.

#### Scenario: Dubbele porties
- **WHEN** een recept voor twee porties met 100 gram rijst voor vier porties wordt bekeken
- **THEN** toont het 200 gram rijst en blijft het opgeslagen recept voor twee porties ongewijzigd

### Requirement: Zoeken en archiveren
Het systeem SHALL recepten op naam en tags laten zoeken, met standaard alleen actieve recepten. Archiveren SHALL het recept en alle verwijzingen behouden; archieven kunnen worden bekeken en hersteld.

#### Scenario: Tag en archief
- **WHEN** een gebruiker op een tag zoekt en daarna een recept archiveert
- **THEN** is het terug te vinden met de archieffilter en kan het worden hersteld

### Requirement: Wijzigingen atomair bewaren
Het systeem SHALL metadata en ingrediëntregels samen opslaan en gelijktijdige wijzigingen herkennen. Een verouderde bewerking SHALL met een conflict worden geweigerd zodat nieuwere gegevens behouden blijven.

#### Scenario: Verouderde editor
- **WHEN** een gebruiker een recept opslaat nadat iemand anders een nieuwere versie heeft opgeslagen
- **THEN** meldt het systeem het conflict en bewaart het de nieuwere versie volledig

### Requirement: Mobiele pagina's en agenttools
Het systeem SHALL zoeken, lezen, aanmaken, wijzigen, schalen, archiveren en herstellen via mobiele pagina's en MCP aanbieden, met dezelfde regels. Pagina's SHALL een eigen URL en terugnavigatie hebben, zonder horizontaal scrollen op 360 pixels en met aanraakdoelen van minstens 44×44 pixels.

#### Scenario: Agent voegt recept toe
- **WHEN** een aangemelde agent een recept met zichtbare ingrediënt-ID's toevoegt
- **THEN** is dat recept direct zichtbaar op de gerechtenpagina van hetzelfde huishouden
