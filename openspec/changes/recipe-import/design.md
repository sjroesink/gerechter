# Design

## Context

Zie proposal.md. `recipe.sourceUrl` en `recipe.photoUrl` bestaan al en worden in UI en MCP gebruikt; de detailpagina toont "Bekijk de bron". De enige uitgaande verzoeken gaan nu naar vaste endpoints (AH-sidecar, Notion). In `ingredient-images` is bewust gekozen voor geen serverdownload van willekeurige URL's. Deze change wijzigt dat voor gerechtfoto's, op uitdrukkelijk verzoek van de gebruiker.

## Goals / Non-Goals

**Goals:**
- een recept-URL omzetten naar een bruikbaar concept
- de bron bewaren
- de afbeelding blijvend zelf bewaren
- uitgaande verzoeken veilig houden

**Non-Goals:**
- ingrediënten automatisch koppelen op de server
- een importknop in de UI
- bestaande gehotlinkte foto's met terugwerkende kracht downloaden
- afbeeldingen schalen of omzetten

## Decisions

1. **De server extraheert, de agent koppelt.** `fetch_recipe_from_url` is alleen-lezen en levert ruwe ingrediëntregels, stappen, metadata en de afbeeldings-URL. Automatisch koppelen gaat te vaak mis, door vage hoeveelheden en ontbrekende ingrediënten. De agent gebruikt daarom de bestaande catalogus- en recepttools en verzint geen omrekeningen.
2. **Eerst schema.org JSON-LD, paginatekst als terugval.** De meeste receptsites publiceren `Recipe` als JSON-LD. Zonder JSON-LD krijgt de agent titel, og:image en de paginatekst (maximaal 20.000 tekens).
3. **De afbeelding wordt bij opslaan gedownload, niet bij uitlezen.**
   - Uitlezen slaat niets op en laat dus geen wezen achter.
   - `createRecipe`/`updateRecipe` downloaden een nieuwe of gewijzigde `photoUrl` vóór de transactie. Dit geldt voor UI en MCP.
   - Bij een downloadfout blijft het gerecht opgeslagen met `photoWarning`, en valt de UI terug op de originele URL.
4. **Opslag als bytea in Postgres.** Eén tabel `image` per huishouden. Dit vraagt geen extra volume of backuppad, past in transacties en werkt in de testcontainers. Het verwachte volume is klein: per gerecht één foto van maximaal 8 MB.
5. **Weergave via `imageUrl`.** Lees- en zoekresultaten krijgen `imageUrl`: `/afbeeldingen/<id>` bij een eigen kopie, anders `photoUrl`. `photoUrl` blijft de originele bron.
6. **Afgeschermde route.**
   - `/afbeeldingen/<id>` vereist een sessie en lidmaatschap van het huishouden van de afbeelding.
   - Headers: `nosniff`, `default-src 'none'` en privé-caching.
   - Wie geen toegang heeft, krijgt 404.
7. **Veilige fetch.**
   - Alleen http(s) op poort 80/443, zonder inloggegevens in de URL.
   - Een undici-`Agent` controleert bij elke verbinding het opgeloste IP-adres. Hij weigert loopback, privé, link-local, CGNAT, multicast en gereserveerde reeksen, ook IPv4-mapped IPv6. Zo vallen ook DNS-rebinding en redirects onder de controle.
   - Grenzen: maximaal vijf redirects, tien seconden, 3 MB HTML en 8 MB per afbeelding.
   - Het type van een afbeelding wordt gecontroleerd op de eerste bytes (JPEG, PNG, WebP, GIF, AVIF), niet alleen op de header.

## Risks / Trade-offs

- [Sites zonder JSON-LD] → paginatekst als terugval; de agent haalt het recept daaruit.
- [Sites die servers blokkeren of de foto weigeren] → duidelijke foutmelding; het gerecht wordt toch opgeslagen en de foto valt terug op de originele URL.
- [Auteursrecht van geïmporteerde recepten en foto's] → bedoeld voor persoonlijk gebruik binnen het huishouden; de bron wordt altijd bewaard en getoond.
- [Opslag groeit in Postgres] → limiet van 8 MB per afbeelding; vervangen of wissen ruimt de oude kopie op.

## Migration Plan

- Eén additieve migratie: tabel `image` en de nullable kolom `recipe.photo_image_id`. Wordt de afbeelding verwijderd, dan wordt de kolom `null` (`set null`).
- Bestaande gerechten houden hun `photoUrl` en blijven die tonen. De foto wordt pas gedownload wanneer de foto-URL bij een latere wijziging verandert.
- Terugdraaien kan door de route en de kolom te negeren; er gaan geen gegevens verloren.

## Sources

- https://schema.org/Recipe
- https://developers.google.com/search/docs/appearance/structured-data/recipe
- https://owasp.org/www-community/attacks/Server_Side_Request_Forgery
