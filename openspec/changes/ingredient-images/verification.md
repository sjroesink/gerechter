# Verificatie ingrediëntafbeeldingen

Gecontroleerd op 5 november 2026.

- Migratie `0009_legal_madame_hydra.sql` bevat uitsluitend een nullable `ingredient.photo`-kolom en is lokaal toegepast.
- `pnpm lint`, `pnpm typecheck` en `git diff --check`: geslaagd.
- `pnpm test`: 199 tests in 26 bestanden geslaagd. De nieuwe catalogustests controleren bewaren, naamwijziging door oude clients, expliciet wissen, globale rechten, andere huishoudens en ongewenste URL-protocollen/aanmeldgegevens. De OAuth-test doorloopt dezelfde fotoacties via MCP.
- `pnpm test:e2e`: 47 tests geslaagd op 360×780 tegen de aparte testdatabase. Vier nieuwe beeldscenario's controleren foto/bron opslaan en tonen in catalogus, voorraad, kiezer en gerecht; fallback en vervangen; globale leesrechten; verwijderen met behoud van ingrediënt/omrekening.
- `openspec validate ingredient-images --strict`: geslaagd.

## Werkelijke beelden

De officiële TheMealDB-ingrediëntenlijst is gelezen en aan de 38 bestaande Nederlandse catalogusnamen gekoppeld. Afbeeldings-URLs zijn gecontroleerd op een geldige image-response, in een browser geladen en visueel nagekeken. De gedocumenteerde `/medium`-variant beperkt de bestandsgrootte.

37 afbeeldingen komen van TheMealDB. De auteur/bron en voorwaardenlink blijven opgeslagen. Sommige foto's bevatten een voorbeeldmerk of -verpakking; de bronvermelding noemt dit illustratief. Volkoren noedels, spaghetti en wraps hebben een algemene illustratie, uitdrukkelijk niet specifiek voor de volkorenvariant. Dit verandert geen productkeuze, hoeveelheid of voedingswaarde.

De TheMealDB-foto voor een knoflookteen toonde knoflookbollen. Hiervoor is de publiek-domeinfoto [White garlic cloves](https://commons.wikimedia.org/wiki/File:White_garlic_cloves.jpg) van Jon Sullivan gebruikt, met auteur, bestandsbron en licentieverwijzing. De Wikimedia-API bevestigde auteur en publiek-domeinstatus.

Alle 38 beelden zijn met de bestaande aangemelde MCP-client in het huishouden `18f2207f-1a40-416a-ba3c-76ee038d5f09` opgeslagen en teruggelezen. Een bestaande foto zou behouden blijven; er waren vooraf nog geen eigen foto's. De eerste JSONB-terugleesvergelijking is gecorrigeerd naar een objectvergelijking, omdat Postgres JSONB geen sleutelvolgorde bewaart. Er zijn hierdoor geen foto's gewist of dubbel aangemaakt.

De actuele browsercontrole op `http://main-pc:3000` bevestigde een echte adminlogin, 38 geladen catalogusfoto's, bronlinks, lange bronvermelding zonder overflow en zeven fotothumbnails bij het pastarecept. Dit gebeurde op 360 px met het systeemdonkere thema en zonder browserfouten. De tijdelijke testsessie is uitgelogd. Lokale screenshots en machineleesbaar MCP-bewijs staan onder de genegeerde datamap.

De tien gerechten en zeven geplande dagen voor 9–15 november zijn behouden. Zoekresultaten en planning vóór/na de beeldkoppeling zijn gelijk; voorraadhoeveelheden en versies zijn niet gewijzigd. De beeldfunctie schrijft alleen catalogusmetadata.

## Aanvulling: boodschappen

De boodschappenpagina toont dezelfde ronde ingrediëntfoto's bij Te kopen, Basisvoorraad en Voldoende voorraad. De beeldmetadata wordt pas na het berekenen van exporttekst en fingerprint toegevoegd. Oude exportsnapshots zonder foto's blijven geldig.

De gerichte behoefte- en synctests slagen (23 tests), evenals TypeScript en de stijlcontroles van de gewijzigde bestanden. De nieuwe domeintest controleert alle drie groepen, behouden tekst/fingerprint na toevoegen van foto's en expliciet verwijderen van een foto. Een echte MCP-vergelijking vóór/na de wijziging bevestigde ongewijzigde tekst en fingerprint voor de dag van 2 november en de week van 9 november, met respectievelijk tien en 29 foto's.

De daadwerkelijke pagina `http://main-pc:3000/meer/boodschappen?kind=day&date=2026-11-02` is na echte adminlogin gecontroleerd: tien geladen ingrediëntfoto's op 360 px, zonder horizontale overflow of browserfouten. De tijdelijke controlesessie is daarna uitgelogd.

## Bronvoorwaarden

[TheMealDB](https://www.themealdb.com/docs_api_guide.php) biedt gratis toegang voor persoonlijke projecten en ontwikkeling. De [voorwaarden](https://www.themealdb.com/terms_of_use.php) zijn geen algemene open licentie voor alle afbeeldingen; publieke uitrol/appstores vragen een aparte beoordeling of supporteraccount. De app gebruikt officiële endpoints en bewaart de bronvermelding. Voor [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) geldt de licentie per bestand.
