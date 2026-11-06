# Proposal

## Why

De gebruiker wil bestaande recepten van internet importeren door een AI-agent alleen een URL te geven. Het recept, de afbeelding en een verwijzing naar het origineel moeten bewaard blijven. Gerechten hebben al een bron- en foto-URL, maar de server kan geen pagina uitlezen. Agents zonder eigen webtoegang kunnen dus niet importeren, en gehotlinkte foto's breken bij linkrot of hotlink-blokkades.

## What Changes

- Nieuwe MCP-tool `fetch_recipe_from_url`: de server haalt de pagina veilig op en leest de schema.org/Recipe-gegevens (JSON-LD) uit tot een concept. Zonder gestructureerde gegevens krijgt de agent de paginatekst. Een eerder geïmporteerd recept met dezelfde bron wordt gemeld.
- De agent koppelt ingrediënten zelf aan de catalogus en slaat op met de bestaande `create_recipe`, inclusief `sourceUrl` en `photoUrl`.
- Bij het opslaan van een gerecht met een nieuwe of gewijzigde foto-URL downloadt de server de afbeelding en bewaart een eigen kopie. `photoUrl` blijft de verwijzing naar het origineel. Mislukt het downloaden, dan wordt het gerecht toch opgeslagen met een waarschuwing.
- Een afgeschermde route `/afbeeldingen/<id>` levert de eigen kopie alleen aan leden van het huishouden.
- Een uitgaande fetch met SSRF-bescherming en grenzen aan redirects, tijd en grootte.

## Capabilities

### New Capabilities

- `recipe-import`: een recept van een URL uitlezen tot een concept voor de agent, met veilige uitgaande verzoeken.

### Modified Capabilities

- `recipe-library`: de gerechtfoto wordt als eigen kopie bewaard en getoond, met de originele URL als verwijzing.

## Impact

- Eén additieve migratie: tabel `image` en kolom `recipe.photo_image_id`.
- Nieuwe runtimeafhankelijkheid `undici` voor de verbindingscontrole.
- Aanpassingen in de domeinlaag voor recepten, de MCP-recepttools, de agent-gids en drie UI-plekken die de foto tonen.
- Bestaande gerechten en hun foto-URL's blijven ongewijzigd werken.
