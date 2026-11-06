# Tasks

## 1. Uitgaande verzoeken en uitlezen

- [x] 1.1 Voeg een veilige fetch toe met adrescontrole bij verbinden en grenzen aan redirects, tijd en grootte. Test geweigerde adressen, redirects, poorten, inloggegevens en limieten.
- [x] 1.2 Bouw de JSON-LD-extractie met paginatekst als terugval. Test met fixtures: @graph, HowToSection, ImageObject, ISO-duur, entities en geen JSON-LD.

## 2. Afbeeldingen en gerechten

- [x] 2.1 Voeg de tabel `image` en `recipe.photo_image_id` toe in één additieve migratie, met controle van het type op de inhoud.
- [x] 2.2 Download de foto bij het opslaan van een gerecht (UI en MCP), met een waarschuwing bij een fout en opruimen bij vervangen of wissen. Geef `imageUrl` terug bij lezen en zoeken.
- [x] 2.3 Lever eigen kopieën via `/afbeeldingen/<id>`, alleen voor leden. Toon `imageUrl` in de UI.

## 3. MCP

- [x] 3.1 Voeg `fetch_recipe_from_url` toe, inclusief een melding van eerder geïmporteerde gerechten, en beschrijf de importworkflow in de agent-gids. Test via OAuth met een gemockte fetcher.

## 4. Integratie

- [ ] 4.1 Voer lint, typecheck, alle tests en strikte OpenSpec-validatie uit. Importeer een echt recept via de aangemelde MCP-client en controleer foto en bronlink in de browser.

## Workflow follow-up

- Review en archiveer met synchronisatie naar hoofd-specs.
