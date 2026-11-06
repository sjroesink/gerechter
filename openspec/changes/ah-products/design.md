# Design

## Context

Zie proposal.md. De AH-export loopt via `ShoppingTarget` → `ahSidecar` (Node) → Python-sidecar met python-appie 0.2.2. De sidecar ontvangt nu `lines: string[]`, groepeert identieke regels, leest de lijst, slaat bestaande identieke tekst over en voegt de rest toe met `add_item(description, quantity=1)`. python-appie biedt ook `products.search(query, limit)` (met id, titel, merk, prijs, bonus, `unit_size`, `image_url`) en `add_item(description, quantity, product_id)`. Het lijst-PATCH-endpoint gebruikt een absoluut aantal: `remove_item` stuurt hetzelfde payload met `quantity: 0`. `get_list` geeft per item `product_id` en `quantity`.

`ShoppingNeeds` wordt per export in `sync_run.snapshot` vastgelegd en via een fingerprint tegen een gewijzigde behoefte beschermd. Ingrediënten zijn globaal (`household_id` null) of eigen; leden beheren eigen ingrediënten. `getAhConnectionReference` vereist nu de eigenaarsrol.

## Goals / Non-Goals

**Goals:** voorspelbare productkeuze door de gebruiker, berekend aantal zonder raden, behoud van herhaalveiligheid en onzeker/gedeeltelijk-herstel, één domeinlaag voor UI en MCP.

**Non-Goals:** automatisch matchen, prijzen of beschikbaarheid bijwerken, uitzonderingen per receptregel, winkelmandje/bestellen, productkoppelingen voor andere providers dan AH.

## Decisions

1. **Postgres-tabel `ingredient_ah_product`** (`id`, `household_id`, `ingredient_id`, `product_id` integer, `title`, `unit_size` text null, `image_url` text null, `pack_amount` double null, `created_at`, `updated_at`), uniek op (`household_id`, `ingredient_id`), cascade bij huishouden; `ingredient_id` restrict zoals receptregels. Checks: `product_id > 0`, `pack_amount is null or between >0 and 1e9`. Alternatief: opslag in de sidecar-SQLite — verworpen: koppelingen zijn huishouddata, moeten overleven bij opnieuw koppelen van AH en via dezelfde domeinlaag lopen. Afbeeldingen worden alleen geaccepteerd als https-URL; ze worden niet gekopieerd (alleen weergave).

2. **Domeinmodule `src/domain/ah-products.ts`** met `getAhProductLinks(ctx, ingredientIds)`, `linkAhProduct(ctx, input)`, `unlinkAhProduct(ctx, ingredientId)` en de pure functies `parseUnitSize(unitSize, baseUnit)` en `ahQuantity(line, link)`. Iedere lidrol mag koppelen; het ingrediënt moet via de bestaande zichtbaarheidsregel (`global of eigen huishouden`) bestaan, anders `NotFound`. Upsert op de unieke sleutel.

3. **Behoefte uitbreiden**: `ShoppingLine` krijgt optioneel `ahProduct: { productId, title, unitSize, imageUrl, packAmount, quantity, check }` (alleen voor `items`). `ShoppingNeeds` krijgt `ahItems: ({ kind: 'product', productId, description, quantity } | { kind: 'text', description })[]`: per item met koppeling één productregel (samengevoegd per product-ID, aantal opgeteld en op 99 begrensd), anders de bestaande tekstregels van dat item. `productId`, `quantity` en `packAmount` gaan mee in de fingerprint (een gewijzigde koppeling maakt een open voorstel ongeldig); titel en afbeelding decoreren na het hashen, zoals foto's. `lines`/`text` blijven ongewijzigd voor share/Notion. Oude snapshots zonder `ahItems` vallen terug op `lines`.

4. **Sidecarcontract**: `POST /exports` accepteert `lines` (tekst, nu 0..500) en optioneel `products: [{ product_id, quantity 1..99, description }]` (0..500), samen minstens één regel. Tekstregels worden als voorheen gegroepeerd. Productregels met hetzelfde ID worden samengevoegd. De invoerhash omvat beide. SQLite `job_lines` krijgt kolommen `product_id INTEGER NULL`, `quantity INTEGER NOT NULL DEFAULT 1` en `target_quantity INTEGER NULL`, toegevoegd met `ALTER TABLE` als ze ontbreken, zodat bestaande databases blijven werken.

5. **Productregel schrijven**: vóór schrijven wordt de lijst eenmaal gelezen tot een map `product_id → aantal`. Per productregel: `target = aanwezig + quantity`; `target_quantity` en status `inflight` worden duurzaam opgeslagen, dan `add_item(description, quantity=target, product_id)`; daarna `sent` en de map bijgewerkt. Omdat het aantal absoluut is, is een tweede schrijfactie met hetzelfde doel niet dubbel, maar we herhalen niet automatisch (zelfde failed/uncertain-grens als nu). Productregels worden niet als "al aanwezig" overgeslagen; optellen is bewust gekozen. Alternatief "overslaan als aanwezig" — verworpen, omdat twee gerechten met dezelfde ui dan te weinig opleveren.

6. **Herstel**: `inspect` bevestigt een onzekere productregel alleen als het product met aantal ≥ `target_quantity` op de lijst staat; tekstregels zoals nu. Een productregel zonder `target_quantity` (nooit inflight) blijft ontbrekend.

7. **Zoeken**: `GET /connections/{id}/products?query=…&limit=…` (query 1..100 tekens, limit 1..30, standaard 20), met server- en verbindingssleutel; gebruikt dezelfde lock per verbinding als exports, zodat tokenrefresh niet gelijktijdig loopt. Het resultaat bevat alleen genormaliseerde velden; `image_url` alleen bij https. Fouten zijn generiek (vaste tekst + HTTP-status). Node valideert de response met zod.

8. **Server/Node**: `ahSidecar` krijgt `searchProducts(reference, query)`; `send` stuurt `lines` en `products` uit `ahItems` (val terug op `lines`). Een nieuwe serverhelper leest de AH-verbindingsreferentie voor leden (`getAhConnectionForMember`, server-only, nooit naar de client) zodat zoeken geen eigenaarsrol vereist. `src/server/ah-products.functions.ts` biedt zoeken/koppelen/ontkoppelen; MCP-tools `search_ah_products`, `link_ingredient_ah_product`, `unlink_ingredient_ah_product` in `src/server/mcp/catalog.ts`; `get_ingredient` en boodschappenreads tonen `ahProduct`.

9. **UI**: gedeeld component `ah-product-search.tsx` (zoekveld, resultatenlijst met foto/titel/inhoud/prijs, inhoudsveld voorgevuld met `parseUnitSize`, opslaan). De ingrediëntpagina (`meer/ingredienten/$ingredientId`) krijgt een sectie "AH-product". `shopping-needs-view.tsx` toont bij doel AH per item het product, aantal en "aantal controleren", of een knop "Koppel product" die het zoekscherm opent en daarna het voorstel ververst. Alles alleen als `AH_SIDECAR_URL` is ingesteld.

## Risks / Trade-offs

- [Lijst-PATCH blijkt een delta i.p.v. absoluut aantal] → afgeleid uit python-appie (`remove` = `quantity: 0`); de transporttest legt het payload vast en de eerste live export wordt handmatig gecontroleerd voordat dit als bewezen geldt.
- [Product uit assortiment of ID ongeldig] → AH weigert; bestaande regels: zonder eerdere toevoeging `failed`, anders `uncertain`. De gebruiker koppelt opnieuw.
- [Gebruiker wijzigt de lijst tijdens een export] → het doel is gebaseerd op één leesactie; gelijktijdige handmatige wijzigingen kunnen overschreven worden. Geaccepteerd voor een korte exportduur.
- [Oude prijs/titel in koppeling] → alleen ter informatie; geen herberekening of automatische vernieuwing.
- [Zoeken wacht op een lopende export door de lock] → korte exports; acceptabel boven gelijktijdige tokenrefresh.

## Migration Plan

Additieve Drizzle-migratie voor `ingredient_ah_product`; SQLite-kolommen worden bij opstarten toegevoegd. Node en sidecar worden samen gedeployed; een oudere sidecar accepteert geen `products` (422 → `failed` zonder schrijven), dus eerst de sidecar bijwerken. Terugrollen: tabel blijft ongebruikt, exports vallen terug op tekstregels.
