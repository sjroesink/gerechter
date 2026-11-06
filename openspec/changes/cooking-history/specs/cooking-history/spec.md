## Purpose

Registreert expliciet gemaakte gerechten met een blijvende momentopname, persoonlijke ervaringen en controleerbare voorraadmutaties, zodat huishoudens zien wat daadwerkelijk is bereid.

## ADDED Requirements

### Requirement: Expliciete registratie met momentopname
Het systeem SHALL een bereiding uitsluitend na een expliciete actie opslaan met datum, porties, actor, receptmomentopname en optionele verwijzing naar een geplande maaltijd. Latere receptwijzigingen, archivering of verwijdering uit planning MUST de geschiedenis niet herschrijven.

#### Scenario: Recept later gewijzigd
- **WHEN** een gerecht na registratie wordt hernoemd of de planning wordt verwijderd
- **THEN** blijft de bereiding haar oorspronkelijke naam, ingrediënten, instructies en porties tonen

### Requirement: Controleerbare aanpasbare afboeklijst
Het systeem MUST vóór bevestiging de beschikbare voorraad, exacte behoefte en voorgestelde afboekingen tonen. Leden SHALL voorgestelde basishoeveelheden kunnen wijzigen of op nul zetten. Bij ontbrekende of vage omrekeningen MUST het voorstel nul zijn met een uitleg; handmatig bevestigde exacte hoeveelheden SHALL mogelijk blijven. Voorraad MUST niet negatief worden.

#### Scenario: Snuf en ontbrekende omrekening
- **WHEN** een ingrediënt alleen als snuf of blik zonder omrekening voorkomt
- **THEN** stelt het systeem geen automatische afboeking voor en kan het lid bewust een bekende basishoeveelheid invoeren

#### Scenario: Minder gebruikt dan het recept
- **WHEN** een lid een voorstel van 400 gram verlaagt naar 300 gram
- **THEN** boekt het systeem bij bevestigen exact 300 gram af en bewaart het die keuze

### Requirement: Atomaire en herhaalveilige bevestiging
Het systeem MUST bereiding, eigen initiële beoordeling en alle bevestigde voorraadmutaties atomair opslaan. Verouderde recept-, planning- of voorraadversies MUST een conflict zonder gedeeltelijke mutaties geven. Herhaald versturen van hetzelfde bevestigingsverzoek MUST dezelfde bereiding teruggeven zonder dubbele afboeking; een gewijzigde inhoud onder dezelfde sleutel MUST worden geweigerd.

#### Scenario: Voorraad tussentijds geteld
- **WHEN** een relevante voorraadversie na het voorstel verandert
- **THEN** mislukt de hele bevestiging en moet het lid de actuele gegevens opnieuw controleren

#### Scenario: Dubbele klik of netwerkherhaling
- **WHEN** hetzelfde bevestigingsverzoek twee keer wordt verstuurd
- **THEN** bestaat één bereiding en één afboeking per bevestigd ingrediënt

### Requirement: Persoonlijke beoordelingen en huishoudafscherming
Het systeem SHALL per bereiding en gebruiker één eigen beoordeling met een optioneel geheel cijfer 1–10 en notitie bewaren. Alleen die gebruiker SHALL de eigen beoordeling wijzigen of wissen. Huishoudleden SHALL de geschiedenis en beoordelingen van hun huishouden kunnen lezen; andere huishoudens MUST geen gegevens kunnen lezen of wijzigen. UI en MCP SHALL dezelfde regels toepassen.

#### Scenario: Twee personen beoordelen
- **WHEN** twee leden dezelfde bereiding beoordelen en één lid diens cijfer wijzigt
- **THEN** blijven beide persoonlijke beoordelingen afzonderlijk bestaan en blijft de andere ongewijzigd

#### Scenario: Ander huishouden
- **WHEN** een lid een bereidings-ID uit een ander huishouden gebruikt
- **THEN** wordt die bereiding als niet gevonden behandeld en verandert er geen voorraad of beoordeling

### Requirement: Mobiele registratie en geschiedenis
Het systeem SHALL een mobiele registratieflow en doorzoekbare geschiedenis met detail bieden. De interface SHALL op 360 px zonder horizontaal scrollen werken en aanraakdoelen van minimaal 44×44 px gebruiken.

#### Scenario: Registreren vanaf planning
- **WHEN** een lid vanuit een geplande maaltijd de gemaakt-flow opent
- **THEN** worden het juiste gerecht en de effectieve porties voorgesteld en kan het lid vóór bevestiging de beoordeling en afboeklijst aanpassen
