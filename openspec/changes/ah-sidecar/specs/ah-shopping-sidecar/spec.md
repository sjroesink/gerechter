## Purpose

Biedt een optionele experimentele AH-boodschappenprovider in een interne service, met afgeschermde aanmelding, duurzame exportstatus en controleerbare foutafhandeling.

## ADDED Requirements

### Requirement: Optionele interne service en afgeschermde verbindingen
De AH-provider SHALL optioneel beschikbaar zijn via een interne Python-sidecar. Alle inhoudelijke serviceaanvragen MUST een gedeeld servergeheim vereisen en iedere verbinding MUST een afzonderlijke geheime toegangssleutel hebben. Verbindingen MUST gescheiden blijven; reads en fouten MUST geen aanmeldcodes, tokens of sleutels teruggeven.

#### Scenario: Ongeldige toegang
- **WHEN** een aanvraag het servergeheim of de juiste verbindingssleutel mist
- **THEN** voert de sidecar geen AH-actie uit en toont zij geen gegevens van de verbinding

### Requirement: Aanmelden en tokenvernieuwing
Alleen een huishoudeigenaar SHALL AH in de webapp kunnen koppelen of loskoppelen. Aanmelden SHALL via een AH-browseraanmeldcode verlopen zonder AH-wachtwoord in Gerechter. Tokens MUST versleuteld per verbinding worden opgeslagen en via de echte client vernieuwd kunnen worden. De webapp SHALL alleen een versleutelde sidecarreferentie bewaren.

#### Scenario: Twee huishoudens
- **WHEN** twee eigenaren ieder AH koppelen
- **THEN** gebruikt iedere boodschappenexport uitsluitend de eigen verbinding en wordt geen globaal gedeeld tokenbestand gebruikt

### Requirement: Expliciete tekstexport met herhaalveiligheid
De provider SHALL alleen een bevestigde boodschappenlijst als tekstregels aan de AH-boodschappenlijst toevoegen. Het systeem MUST product- en bestelkeuzes ongewijzigd laten. Dezelfde verbindings-/export-ID met dezelfde inhoud MUST dezelfde duurzame job gebruiken zonder opnieuw te schrijven; afwijkende inhoud onder die sleutel MUST worden geweigerd.

#### Scenario: Herhaalde aanvraag
- **WHEN** hetzelfde bevestigde exportverzoek door een netwerkherhaling twee keer aankomt
- **THEN** wordt iedere regel hoogstens eenmaal door die job als schrijfactie gestart

#### Scenario: Tekstregelcontract
- **WHEN** de provider een bevestigde tekstregel toevoegt
- **THEN** verstuurt de compatibiliteitsadapter de volledige omschrijving met quantity 1, type SHOPPABLE, originCode PRD en strikeThrough false, zonder product-ID te verzinnen of een afgewezen aanvraag automatisch te herhalen

### Requirement: Deelresultaten en read-only herstel
De sidecar MUST voortgang per regel bewaren vóór en na schrijven. Afgebroken of onzekere jobs MUST na herstart niet automatisch verder schrijven. Statuscontrole SHALL met leesaanvragen controleren of onzekere regels al aanwezig zijn. Bestaande identieke tekstregels SHALL niet opnieuw worden toegevoegd. Een gedeeltelijk resultaat MUST zichtbaar blijven in SyncRun-historie.

#### Scenario: Antwoord na toevoegen valt weg
- **WHEN** AH een regel toevoegt maar het antwoord wegvalt
- **THEN** blijft het resultaat onzeker en kan een leescontrole de bestaande regel herkennen zonder dezelfde schrijfactie te herhalen

#### Scenario: Concrete fout zonder geheimen
- **WHEN** lezen of toevoegen faalt
- **THEN** toont de exportstatus de mislukte fase en indien beschikbaar de HTTP-status met een vaste toelichting, zonder responsebody, URL, token of ruwe exceptiontekst; een mogelijke toevoeging blijft onzeker

### Requirement: Mobiele inrichting en eerlijke verificatie
De webapp SHALL AH als experimenteel doel tonen, eigenaren aanmeldinstructies bieden en werkelijke runstatus weergeven via UI en MCP. Ontbrekende configuratie of aanmelding MUST andere boodschappendoelen bruikbaar laten. Tests MUST contractcontrole en een eventuele live AH-accountcontrole onderscheiden.

#### Scenario: Geen AH-aanmelding
- **WHEN** de sidecar draait maar nog geen AH-verbinding is ingesteld
- **THEN** blijven Delen en Notion bruikbaar en wordt geen AH-lijst gewijzigd
