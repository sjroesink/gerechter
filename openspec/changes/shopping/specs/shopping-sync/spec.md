## Purpose

Maakt gecontroleerde boodschappenexport naar het deelmenu, klembord en Notion mogelijk, met afgeschermde verbindingen en een herleidbare geschiedenis die onbedoelde dubbele verzending voorkomt.

## ADDED Requirements

### Requirement: Delen en kopiëren met eerlijk resultaat
Het systeem SHALL een leesbare boodschappenlijst via het beschikbare deelmenu of klembord aanbieden met een tekstfallback. Een geannuleerd deelmenu MUST niet als verzonden worden gemeld. Een lokale deel- of kopieerbevestiging MUST niet als ontvangst door een externe ontvanger worden gepresenteerd.

#### Scenario: Deelmenu niet beschikbaar
- **WHEN** de browser geen deelmenu of veilige klembord-API aanbiedt
- **THEN** kan het lid de lijst via een beschikbare kopieerfallback of selecteerbare tekst gebruiken

### Requirement: Notion-verbinding per huishouden
Het systeem SHALL een echte Notion-checklistpagina onder een gekozen ouderpagina kunnen maken. Alleen een huishoudeigenaar SHALL de verbinding instellen of verwijderen. Geheimen MUST versleuteld worden opgeslagen en nooit terugkomen in lees-API's, MCP, HTML of exporthistorie. Leden SHALL de ingestelde verbinding kunnen gebruiken.

#### Scenario: Geen verbinding
- **WHEN** een lid Notion kiest zonder ingestelde verbinding
- **THEN** wordt geen externe aanvraag uitgevoerd en verwijst de interface naar de verbindingsinstelling

### Requirement: SyncRun-historie en herhaalveiligheid
Het systeem MUST per export de actor, bronkeuze, oorspronkelijke lijst, doel, tijd en status bewaren binnen het huishouden. Herhaling van dezelfde bevestigingssleutel MUST dezelfde run teruggeven zonder opnieuw te verzenden. Reeds geclaimde overlappende bronnen MUST standaard worden geweigerd; opnieuw exporteren SHALL alleen na een expliciete herhaalkeuze kunnen.

#### Scenario: Eerst dag dan week
- **WHEN** een dag al naar hetzelfde doel is geëxporteerd en een week dezelfde geplande maaltijd bevat
- **THEN** voorkomt het systeem een stille tweede export en toont het de eerdere run

#### Scenario: Herhaalde bevestiging
- **WHEN** dezelfde exportbevestiging twee keer wordt verstuurd
- **THEN** wordt hoogstens één externe schrijfactie gestart en krijgen beide verzoeken dezelfde run

### Requirement: Onzekere externe resultaten
Het systeem MUST een externe schrijftime-out of onduidelijk resultaat als onzeker bewaren en MUST dit niet automatisch opnieuw versturen. Het systeem SHALL een read-only statuscontrole aanbieden die een reeds gemaakte Notion-pagina kan terugvinden. Een duidelijke afwijzing of annulering SHALL opnieuw proberen na een nieuw bevestigd voorstel toestaan.

#### Scenario: Notion schrijft maar antwoord valt weg
- **WHEN** Notion de pagina maakt maar de aanvraag geen betrouwbaar antwoord oplevert
- **THEN** blijft de run onzeker, gebeurt geen automatische tweede schrijfactie en kan statuscontrole de bestaande pagina koppelen

### Requirement: Mobiele interface MCP en huishoudafscherming
Het systeem SHALL behoefte, verbindingstatus, export en runhistorie via mobiele UI en MCP aanbieden met dezelfde regels. Andere huishoudens MUST geen verbindingen, bronnen of runs kunnen lezen of wijzigen. De UI SHALL op 360 px zonder horizontaal scrollen werken met doelen van minimaal 44×44 px.

#### Scenario: Ander huishouden
- **WHEN** een lid een run-ID uit een ander huishouden gebruikt
- **THEN** behandelt het systeem deze als niet gevonden en verandert er geen exportstatus
