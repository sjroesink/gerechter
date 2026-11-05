# Design

## Context

De repository is greenfield: er is alleen OpenSpec- en agent-tooling, geen applicatiecode. Zie proposal.md voor de motivatie. Deze change legt het fundament voor negen geplande changes. Daarom staat hieronder ook de **overall architectuur** zoals die in de verkenning is vastgesteld, zodat latere changes ernaar kunnen verwijzen.

Randvoorwaarden:
- Meerdere gebruikers en huishoudens; de opzet moet later breder inzetbaar zijn. v1 werkt alleen met uitnodigingen.
- Voorlopig lokaal met docker-compose; later op Unraid met een publiek subdomein.
- De AH-koppeling (python-appie) is Python en draait later als losse sidecar (change 9). De rest is TypeScript.
- Mobiel eerst; weinig informatie per scherm.

## Overall architectuur (referentie voor alle changes)

```
 +------------------------------------------------------------+
 |  TanStack Start (één Node-proces)                          |
 |                                                            |
 |   UI (React, mobile-first)                                 |
 |        |  server functions                                 |
 |        v                                                   |
 |   +----------------------------------------------+         |
 |   |  Domeinlaag (TS) - enige plek voor regels     |        |
 |   +----------------------------------------------+         |
 |        ^                ^                 |                |
 |   /api/* (later)     /mcp (OAuth)         | ShoppingTarget |
 +-------|----------------|-----------------|-----------------+
                                            v
          Postgres                   AH-sidecar (Python, intern, change 9)
```

Vastgestelde keuzes voor latere changes (geen onderdeel van deze change):

| Onderwerp | Besluit |
|---|---|
| Tenant | Huishouden. Planning, gerechten, voorraad, sync-koppelingen en MadeEvents zijn per huishouden. Beoordelingen zijn per persoon per MadeEvent. |
| Ingrediënten | Globale catalogus (door platformbeheerder beheerd) plus eigen ingrediënten per huishouden; voorraad en basisvoorraad staan in een overlay per huishouden. |
| Eenheden | Vaste set met dimensies (massa, volume, aantal, vaag). Basiseenheid per ingrediënt; omrekeningen per ingrediënt. Ontbreekt een omrekening, dan worden regels niet samengevoegd. Vage eenheden worden nooit afgeboekt. |
| Porties | Op recept, standaard per huishouden, te overschrijven per geplande dag; hoeveelheden schalen lineair. |
| Zoeken | pg_trgm + aliassen voor ingrediënten, tags voor gerechten; pgvector later achter dezelfde zoekinterface. MCP: eerst kandidaten zoeken, alleen nieuw aanmaken als niets past. |
| Instructies | Vaste secties als data; OpenUI-blokken (thesysdev) alleen binnen secties, met een beperkte componentbibliotheek. De ingrediëntensectie wordt afgeleid en nooit gegenereerd. |
| Gemaakt | Expliciete actie: beoordeling (cijfer + notitie) per persoon, daarna een aanpasbare lijst met voorraadafboekingen. |
| Verwijderen | Gerechten worden gearchiveerd, niet verwijderd. |
| Boodschappen | Behoefte (benodigd − voorraad − basisvoorraad) los van providers. `ShoppingTarget`-interface met Delen (Web Share API) en Notion als standaard; AH experimenteel via sidecar. Sync per dag/gerecht en per week; een SyncRun-historie voorkomt dubbel toevoegen. |

## Goals / Non-Goals

**Goals:**
- Een projectstructuur en conventies die latere changes zonder herontwerp kunnen volgen, in het bijzonder de tenant-scoping en het adapterpatroon.
- Auth, huishoudens en MCP-autorisatie volledig werkend, inclusief tests op afscherming.
- Een container-setup die identiek naar Unraid kan.

**Non-Goals:**
- Visueel ontwerp of huisstijl verder dan een nette, consistente basis.
- E-mailverzending, passkeys, social login.
- Postgres row-level security (zie Decisions).
- Productie-hardening voor publieke uitrol (rate limiting, CAPTCHA, monitoring); dat komt bij de stap naar Unraid.

## Decisions

### 1. TanStack Start als full-stack framework
UI, server functions en server routes (`/mcp`, `/health`) draaien in één proces. Server functions geven typeveilige RPC voor de UI zonder een aparte API te onderhouden.
*Alternatieven:* Next.js (zwaarder, sterker gekoppeld aan Vercel-conventies), en een losse Hono-API met een React SPA (twee deploys, en een API die je voor de UI zelf moet onderhouden). Met de keuze van de gebruiker voor TanStack Start en een sidecar voor Python ligt dit vast.

### 2. Domeinlaag met een verplicht contextobject
Alle bedrijfslogica staat in `src/domain/<module>/` als functies die een `Ctx` als eerste argument krijgen:

```ts
type Ctx = { db: Db; user: { id; role }; household: { id; role } }
```

Adapters bouwen de `Ctx`. De UI doet dat via `ctxFromSession(request)` in server functions, MCP via `ctxFromMcpToken(claims)`. Domeinfuncties lezen of schrijven nooit huishoudgegevens zonder `ctx.household.id`. Tabellen met huishoudgegevens krijgen een `household_id` dat niet leeg mag zijn. Rechten (eigenaar of lid, platformbeheerder) worden in de domeinlaag gecontroleerd, niet in de adapters.
*Alternatief:* Postgres RLS met `SET app.household_id` per transactie. Dat is sterker, maar voegt complexiteit toe in connection pooling en migraties. Het is uitgesteld; de `household_id`-kolommen houden die weg open.

### 3. Postgres + Drizzle ORM
Drizzle geeft TS-schema's, SQL-nabije queries (nodig voor pg_trgm en later pgvector) en `drizzle-kit` voor migraties. Migraties staan als SQL-bestanden in de repo en worden bij het opstarten uitgevoerd met de migrator van `drizzle-orm`, vóór de HTTP-server luistert.
*Alternatief:* Prisma. Dat werkt minder soepel met Postgres-extensies en ruwe SQL, en heeft een zwaardere runtime.

### 4. Better Auth voor accounts, huishoudens en MCP-OAuth
- **E-mail + wachtwoord** als enige inlogmethode in v1.
- **Eigen tabellen voor huishoudens** (`household`, `membership` met rol `owner` | `member`) in plaats van de organization-plugin, en een eigen veld `user.role` (`user` | `admin`) in plaats van de admin-plugin. *Bijgesteld tijdens implementatie:* beide plugins stellen publieke endpoints beschikbaar (organisatie aanmaken, leden en rollen beheren, gebruikers aanmaken) die de regels uit de domeinlaag zouden omzeilen, zoals registratie alleen via uitnodiging en minstens één eigenaar. Het actieve huishouden is `user.lastActiveHouseholdId`; daarmee blijft de keuze bewaard bij een nieuwe inlog en gebruikt MCP hetzelfde huishouden.
- **Eigen uitnodigingstabel**, want we willen een link voor eenmalig gebruik zonder e-mail. Tabel `invite`: `token_hash`, `kind` (`member` | `new_household`), `household_id` (bij `member`), `proposed_household_name` (bij `new_household`), `expires_at`, `used_at`, `revoked_at`, `created_by`. Het token wordt alleen als hash opgeslagen.
- **Registratie blokkeren** met een `databaseHooks.user.create.before`-hook: die weigert elk nieuw account, tenzij de domeinfunctie voor registratie (met een geldig uitnodigingstoken, of de bootstrap: nul gebruikers en het e-mailadres gelijk aan `ADMIN_EMAIL`) via een AsyncLocalStorage-context toestemming geeft. Zo geldt de regel voor elk pad naar `user`-aanmaak, ook het publieke sign-up-endpoint.
- **Wachtwoordherstel**: de ingebouwde reset-flow van Better Auth, met een `sendResetPassword`-callback die de link niet mailt maar teruggeeft aan de beheerder die hem aanvraagt. Geldigheid 24 uur, `revokeSessionsOnPasswordReset: true`.
- **MCP-plugin** (`@better-auth/mcp`, met de `jwt`- en `cimd`-plugins): Better Auth wordt OAuth-autorisatieserver voor `/mcp`, met een eigen inlog- en toestemmingspagina. `resource` = `${PUBLIC_BASE_URL}/mcp`.

*Alternatieven:* Auth.js (zwakkere ondersteuning voor organisaties en MCP), Lucia (deprecated), of zelf bouwen (te veel risico). Better Auth dekt organisaties, admin en MCP-OAuth uit één bibliotheek.

### 5. MCP-server in hetzelfde proces
Een server route `/mcp` (POST) met `createMcpHandler` uit de officiële MCP TypeScript SDK, omhuld door `requireMcpAuth` van Better Auth. Per verzoek wordt een `McpServer` gemaakt en er wordt geen sessiestatus bewaard. Tools zijn dunne wrappers: valideren met zod, `ctxFromMcpToken` aanroepen, dan de domeinfunctie. In deze change komt er alleen `whoami`. Het huishouden voor MCP is `lastActiveHouseholdId` van de gebruiker; wisselen via MCP komt bij de MCP-tools (change 8).
*Oudere protocolversie:* standaard accepteren we ook de vorige MCP-protocolversie, voor compatibiliteit met clients die nog niet zijn bijgewerkt. Dat staat in één optie en is later strakker te zetten.

### 6. Mobiele schil met file-based routing
TanStack Router-routes volgen de drill-down-structuur (`/week`, `/gerechten`, `/voorraad`, `/meer`, `/meer/huishouden`, ...). Een layout-route `_app` bevat de navigatiebalk en controleert de sessie. Publieke routes (`/login`, `/setup`, `/uitnodiging/$token`, `/herstel/$token`, `/consent`) vallen erbuiten. Een kop-component met titel en terugknop wijst naar de ouder-route (niet naar `history.back()`), zodat directe links ook werken. Styling met Tailwind CSS v4; de ontwerpbasis is 360 px breed.

### 7. Configuratie en container
Omgevingsvariabelen worden bij het opstarten gevalideerd met een zod-schema (`DATABASE_URL`, `PUBLIC_BASE_URL`, `BETTER_AUTH_SECRET`, `ADMIN_EMAIL`, `PORT`). Een multi-stage Dockerfile (Node 24 LTS, pnpm) levert een slanke runtime-image. In `docker-compose.yml` staan `app` en `db` (Postgres 17, met de extensie `pg_trgm` vast aangezet via een migratie). De app hangt af van een gezonde database, en `./data/postgres` is het enige volume. Dezelfde compose-structuur gaat later naar de Compose-Manager op Unraid.

### 8. Teststrategie
- **Vitest + Testcontainers (Postgres)** voor domein- en integratietests tegen een echte database. Elke domeinmodule krijgt een afschermingstest: data van huishouden A is onzichtbaar en onwijzigbaar vanuit een `Ctx` van huishouden B.
- **Playwright** met een mobiele viewport (360×780) voor de belangrijkste flows: bootstrap, uitnodigen en registreren, wisselen van huishouden, navigatie.
- **MCP**: een integratietest die zonder token 401 verwacht, en met een geldig token `whoami` aanroept.

## Risks / Trade-offs

- [De MCP-plugin van Better Auth en het nieuwe MCP-protocol zijn jong; clients kunnen afwijken] → vroeg testen met Claude Code als client (taak in tasks.md); de oudere protocolversie blijft geaccepteerd.
- [Een uitnodigingslink kan uitlekken] → eenmalig te gebruiken, 7 dagen geldig, in te trekken, en het token alleen als hash opgeslagen.
- [Bij een publieke uitrol zou iemand anders de bootstrap kunnen kapen] → bootstrap werkt alleen met `ADMIN_EMAIL` en alleen zolang er nul gebruikers zijn.
- [Een vergeten `household_id`-filter lekt gegevens tussen huishoudens] → `Ctx` verplicht in de domeinlaag, helper-queries die altijd scopen, en een afschermingstest per module. RLS blijft een optie voor later.
- [Zonder e-mail is wachtwoordherstel afhankelijk van de beheerder] → acceptabel voor v1 met alleen uitnodigingen; e-mail (bijvoorbeeld via SES) komt bij de publieke uitrol.
- [TanStack Start is jonger dan Next.js] → domeinlaag en adapters zijn framework-onafhankelijk, dus vervangen van de webschil blijft beperkt.

## Migration Plan

Greenfield, dus er is geen bestaande data. Uitrol: `docker compose up`, de beheerder doorloopt `/setup`. Terugdraaien: containers stoppen; de data staat in `./data`.

## Open Questions

- Wanneer e-mailverzending erbij komt (uitnodigingen en herstel per mail): bij de stap naar Unraid of later. Dit verandert deze change niet; de linkflow blijft bestaan.
