# Proposal

## Why

De catalogus is beschikbaar, maar huishoudens kunnen nog geen gerechten bewaren, bekijken of via een agent toevoegen. De gevraagde voorbeeldgerechten vereisen een volledige receptbibliotheek met echte ingrediëntverwijzingen en veilige, bruikbare instructies.

## What Changes

- Gerechten per huishouden met naam, beschrijving, porties, bereidingstijden, tags, bron- en foto-URL.
- Ingrediëntregels met hoeveelheden, eenheden en notities; de weergave schaalt met de gekozen porties.
- Zoeken, lezen, toevoegen, wijzigen, archiveren en herstellen via mobiele pagina's en MCP.
- Vaste instructiesecties met tekst en optionele OpenUI-blokken uit een beperkte componentbibliotheek.
- Een afgeleide ingrediëntensectie en expliciete documentatie voor agents, zonder gegenereerde of afwijkende ingrediëntlijsten in OpenUI.

## Capabilities

### New Capabilities

- `recipe-library`: afgeschermde recepten, ingrediëntenlijsten, porties, metadata, zoeken en archivering.
- `recipe-instructions`: vaste instructiesecties en veilige OpenUI-weergave met toegestane componenten.

### Modified Capabilities

Geen. De bestaande catalogus wordt gebruikt zonder haar zichtbaarheid of beheerregels te veranderen.

## Impact

Nieuwe recepttabellen en migratie, domeinfuncties, server functions, mobiele receptenpagina's en MCP-tools. De officiële OpenUI-parser en React-renderer worden toegevoegd voor een eigen beperkte bibliotheek. De bestaande accounts, huishoudens, themavoorkeur en catalogus blijven behouden.
