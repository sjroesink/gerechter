# Verificatie: tekstexportcorrectie, 5 november 2026

## Waarneming

De gebruiker meldde een geweigerde export van tien regels voor 2 november. De bestaande SQLite-opslag
bevatte twee mislukte jobs, ieder gestopt bij de eerste regel; nul regels bevestigd. De opgeslagen
generieke fout bevatte geen HTTP-status, dus de precieze historische afwijzing is niet te reconstrueren.
De bestaande gekoppelde AH-aanmelding kon de lijst wel uitlezen: HTTP 200, het verwachte items-veld,
nul items. Aanmelding en leesverbinding werken dus; dat bewijst niet dat toevoegen is toegestaan.

## Correctie

- python-appie 0.2.2 verstuurt tekstregels met originCode TXT zonder strikeThrough. De oorspronkelijke
  [appie-go-client](https://github.com/gwillem/appie-go/blob/main/shoppinglist.go) gebruikt ook voor vrije
  tekst PRD en strikeThrough=false. Een lokale ListsAPI-subclass past alleen dit toevoegpayload aan;
  omschrijvingen, hoeveelheden en overige echte clientfunctionaliteit blijven behouden.
- De transportfixture weigert voortaan afwijkende payloads. De nieuwe regressietest met de volledige
  kruidenregel faalde vóór de correctie en slaagt erna. Er wordt geen product-ID verzonnen.
- Fouten geven vaste fase-/HTTP-/netwerkdiagnostiek; geen responsebody, URL, token of ruwe exceptiontekst.
  Tests controleren 400/401/403/408/429/500, eerste reads, read-only herstel en het ontbreken van retries.
  De bestaande failed/uncertain-grens en voortgangsbewaking blijven behouden.

## Uitgevoerd

- `uv run --project sidecar pytest sidecar/tests -q`: **23 geslaagd** met fictief HTTP-transport en
  tijdelijke SQLite-databases; geen live AH-mutaties.
- `uv run --project sidecar ruff check sidecar` en `ruff format --check sidecar`: geslaagd.
- `pnpm exec vitest run src/server/shopping-targets/ah.test.ts src/server/shopping-targets/ah-setup.test.ts`:
  **10 geslaagd**.
- `docker compose -f docker-compose.yml -f docker-compose.ah.yml up -d --build ah`: geslaagd.
  Alleen de sidecar opnieuw gestart, met behoud van het bestaande datavolume. Dockerhealth: healthy.
- De nieuwe runtime gebruikt daadwerkelijk CompatibleLists met het verwachte payload. De bestaande
  live verbinding opnieuw uitsluitend uitgelezen: één actieve verbinding, lijst leesbaar, nul items.
  Jobtellingen ongewijzigd: twee failed, geen nieuwe of hervatte export.

## Grens van het bewijs

Deze correctie is op broncode en strikte contracttests gebaseerd. Er is geen nieuwe live schrijfactie
uitgevoerd en dus nog geen bewijs dat AH de aangepaste tekstregels op dit account accepteert. De oude
mislukte exports blijven mislukt. Een bewuste nieuwe export via Nieuw voorstel voor deze bron kan het
schrijfresultaat aantonen; een volgende weigering toont de concrete fase en HTTP-status.
