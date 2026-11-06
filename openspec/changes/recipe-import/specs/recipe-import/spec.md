# Spec Delta

## Purpose

Laat een AI-agent een bestaand recept van een URL importeren, met behoud van de bron en zonder dat de server onveilige uitgaande verzoeken doet.

## ADDED Requirements

### Requirement: Recept uitlezen van een URL
Het systeem SHALL via MCP een recept-URL kunnen uitlezen tot een concept met:
- naam en beschrijving
- porties
- voorbereidings- en kooktijd
- ruwe ingrediëntregels en stappen
- voorgestelde tags
- afbeeldings-URL
- de uiteindelijke bron-URL

Uitlezen SHALL niets opslaan. Ontbreken gestructureerde receptgegevens, dan SHALL het systeem titel, afbeelding en paginatekst teruggeven zodat de agent zelf kan uitlezen.

#### Scenario: Pagina met schema.org-recept
- **WHEN** een agent een URL opgeeft van een pagina met een JSON-LD `Recipe`
- **THEN** krijgt de agent een gestructureerd concept met ingrediëntregels, stappen en een absolute afbeeldings-URL, en wordt er niets opgeslagen

#### Scenario: Pagina zonder gestructureerde gegevens
- **WHEN** de pagina geen JSON-LD `Recipe` bevat
- **THEN** krijgt de agent een concept zonder structuur, met titel, afbeelding en paginatekst

#### Scenario: Eerder geïmporteerd
- **WHEN** het actieve huishouden al een gerecht met dezelfde bron-URL heeft
- **THEN** vermeldt het concept het ID van dat gerecht zodat de agent geen dubbel gerecht maakt

### Requirement: Veilige uitgaande verzoeken
Het systeem SHALL bij uitlezen en downloaden alleen http(s)-URL's op de standaardpoorten zonder inloggegevens benaderen. Het SHALL verbindingen naar loopback-, privé-, link-local- en andere niet-publieke adressen weigeren, ook na DNS-resolutie en na redirects. Het SHALL het aantal redirects, de duur en de grootte van het antwoord begrenzen.

#### Scenario: Intern adres
- **WHEN** een URL of een redirect naar een intern of privéadres leidt
- **THEN** weigert het systeem het verzoek met een foutmelding en wordt er niets opgehaald

#### Scenario: Te groot antwoord
- **WHEN** een antwoord groter is dan de limiet
- **THEN** breekt het systeem het ophalen af met een foutmelding
