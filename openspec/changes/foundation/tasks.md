# Tasks

## 1. Projectopzet

- [x] 1.1 Scaffold een TanStack Start-project (React, TypeScript strict, pnpm, Node 24) in de repo-root en verifieer dat `pnpm dev` een pagina serveert op `http://localhost:3000`
- [x] 1.2 Voeg Tailwind CSS v4, ESLint, Prettier, Vitest en Playwright toe, met scripts `lint`, `typecheck`, `test` en `test:e2e`, en verifieer dat alle vier slagen op het lege project
- [x] 1.3 Leg de mappenstructuur vast (`src/domain`, `src/db`, `src/auth`, `src/server/mcp`, `src/routes`, `src/components`) met een korte `README.md` die de laagindeling en het adapterpatroon uitlegt, en verifieer dat de README naar design.md verwijst
- [x] 1.4 Initialiseer git met een `.gitignore` (inclusief `data/`, `.env`) en verifieer dat `git status` geen gegenereerde of geheime bestanden toont

## 2. Configuratie en database

- [x] 2.1 Implementeer env-validatie met zod (`DATABASE_URL`, `PUBLIC_BASE_URL`, `BETTER_AUTH_SECRET`, `ADMIN_EMAIL`, `PORT`) en maak `.env.example` met uitleg per variabele; verifieer met een unittest dat een ontbrekende variabele een foutmelding met de naam van die variabele geeft
- [x] 2.2 Zet Drizzle op (client, `drizzle.config.ts`, schema-map) met een eerste migratie die `pg_trgm` aanzet, en verifieer dat `pnpm db:migrate` tegen een lokale Postgres slaagt
- [x] 2.3 Zet Testcontainers-Postgres op als Vitest-fixture, die migraties uitvoert per testrun, en verifieer met een smoke-test die `select 1` en de aanwezigheid van `pg_trgm` controleert
- [x] 2.4 Voer migraties uit bij het opstarten van de server, vóór er verzoeken worden aangenomen, en verifieer met een integratietest dat een mislukte migratie het opstarten afbreekt

## 3. Domeinkern en tenant-scoping

- [x] 3.1 Definieer het type `Ctx`, de fouttypes (`Unauthenticated`, `NotFound`, `Forbidden`, `NoActiveHousehold`) en helpers voor rolcontrole in `src/domain/core`, en verifieer met unittests dat de rolhelpers de juiste fouten geven
- [x] 3.2 Implementeer `ctxFromSession` voor server functions en verifieer met een integratietest dat een verzoek zonder sessie `Unauthenticated` geeft en een gebruiker zonder huishouden `NoActiveHousehold`
- [x] 3.3 Voeg een herbruikbare afschermingstest-helper toe (twee huishoudens, twee gebruikers) die latere modules kunnen gebruiken, en verifieer dat die werkt op een testtabel met `household_id`

## 4. Accounts (spec: accounts)

- [x] 4.1 Configureer Better Auth met de Drizzle-adapter, e-mail + wachtwoord, een eigen rolveld op de gebruiker en eigen huishoud-/lidmaatschapstabellen (rollen owner/member), genereer de auth-tabellen als migratie, en verifieer dat de migratie slaagt
- [x] 4.2 Maak de tabel `invite` (token-hash, kind, household_id, voorgestelde naam, expires/used/revoked, created_by) en de domeinfuncties om uitnodigingen aan te maken, te valideren, te verbruiken en in te trekken, en verifieer met tests op verlopen, gebruikte en ingetrokken tokens
- [x] 4.3 Blokkeer sign-up via een `before`-hook, tenzij er een geldig uitnodigingstoken is of de bootstrap-situatie geldt, en verifieer met tests de scenario's "Registreren zonder uitnodiging", "Ander e-mailadres bij bootstrap" en "Setuppagina na bootstrap"
- [x] 4.4 Bouw de pagina's `/login`, `/setup` en `/uitnodiging/$token` (registreren of accepteren), met lidmaatschap en huishouden in één transactie, en verifieer met Playwright de bootstrap en de registratie via uitnodiging, inclusief de foutmelding bij een verlopen uitnodiging
- [x] 4.5 Implementeer uitloggen en de inlogfout die niets prijsgeeft, en verifieer met Playwright de scenario's "Gebruiker logt uit" en "Ongeldige inloggegevens"
- [x] 4.6 Implementeer huishouden-uitnodigingen door de beheerder (pagina Beheer) en verifieer met tests dat alleen de rol admin ze kan aanmaken en dat accepteren een nieuw huishouden oplevert met de accepterende persoon als eigenaar
- [x] 4.7 Implementeer de herstellink (aanvragen door de beheerder, link teruggeven in plaats van mailen, 24 uur geldig, sessies intrekken) met de pagina `/herstel/$token`, en verifieer met tests op gebruik, verloop en ingetrokken sessies

## 5. Huishoudens (spec: households)

- [x] 5.1 Implementeer domeinfuncties voor de ledenlijst, rol wijzigen, lid verwijderen en verlaten, met de regel "minstens één eigenaar", en verifieer met tests alle scenario's uit spec households, waaronder "Laatste eigenaar"
- [x] 5.2 Implementeer het actieve huishouden (sessie plus `lastActiveHouseholdId`) en wisselen, en verifieer met een test dat de keuze bewaard blijft bij een nieuwe inlog
- [x] 5.3 Bouw de pagina's `/meer/huishouden` (leden, openstaande uitnodigingen, uitnodigen met kopiëren of Web Share, intrekken) en de huishoudwisselaar (alleen zichtbaar bij meerdere huishoudens), en verifieer met Playwright: uitnodigen, accepteren als bestaand account, wisselen
- [x] 5.4 Verifieer met afschermingstests dat leden-, uitnodigings- en wisselfuncties geen gegevens van een ander huishouden tonen of wijzigen, ook niet met gemanipuleerde ID's

## 6. App-schil (spec: app-shell)

- [x] 6.1 Bouw de `_app`-layout met een vaste navigatiebalk onderin (Week, Gerechten, Voorraad, Meer) en een sessiecontrole met doorsturen naar `/login?redirect=...`, en verifieer met Playwright het scenario "Niet ingelogd naar beschermde pagina"
- [x] 6.2 Bouw de kop-component (titel + terugknop naar de ouder-route) en lege staten voor Week, Gerechten en Voorraad, en verifieer met Playwright "Terug vanaf detailpagina" en "Directe link"
- [x] 6.3 Bouw de sectie Meer (Account, Huishouden, Verbonden apps, en Beheer alleen voor de beheerder) en verifieer met Playwright beide scenario's van de requirement Sectie Meer
- [x] 6.4 Verifieer met Playwright op 360 px breedte dat geen enkele pagina horizontaal scrolt en dat interactieve elementen minstens 44×44 px zijn

## 7. MCP-toegang (spec: mcp-access)

- [x] 7.1 Configureer de Better Auth-plugins `jwt`, `mcp` (resource `${PUBLIC_BASE_URL}/mcp`, loginPage, consentPage) en `cimd`, met de bijbehorende migratie, en verifieer dat de endpoints voor OAuth-metadata en protected-resource-metadata geldige JSON teruggeven
- [x] 7.2 Bouw de toestemmingspagina `/consent` (verlenen en weigeren) en verifieer met een test dat weigeren geen token oplevert
- [x] 7.3 Implementeer de server route `/mcp` met `createMcpHandler` en `requireMcpAuth`, plus `ctxFromMcpToken` en de tool `whoami`, en verifieer met integratietests: geen token geeft 401 met `WWW-Authenticate`, een geldig token laat `whoami` gebruiker en huishoudens teruggeven, en zonder huishouden volgt een foutmelding
- [x] 7.4 Bouw de pagina `/meer/verbonden-apps` (verleende clients tonen en intrekken) en verifieer met een test dat een ingetrokken client daarna 401 krijgt
- [x] 7.5 Verbind Claude Code handmatig met `http://localhost:3000/mcp`, doorloop de OAuth-flow, roep `whoami` aan, en leg de stappen vast in `README.md`

## 8. Container en health (spec: deployment)

- [x] 8.1 Implementeer `/health` (200 als de database bereikbaar is, anders 503) en verifieer beide scenario's met een integratietest
- [x] 8.2 Schrijf een multi-stage `Dockerfile` (Node 24, pnpm, alleen productie-afhankelijkheden) en verifieer dat `docker build` slaagt en de container start
- [x] 8.3 Schrijf `docker-compose.yml` (`app` + `db` Postgres 17, healthchecks, `depends_on: service_healthy`, volume `./data/postgres`) en verifieer: een verse `docker compose up` toont `/setup`, en na `docker compose down` en weer `up` zijn de gegevens er nog
- [x] 8.4 Documenteer in `README.md` lokaal starten, de env-variabelen, back-up (de map `data/`) en de verwachte stappen voor Unraid, en verifieer dat de instructies vanaf een schone checkout werken

## 9. Integratiecontrole

- [x] 9.1 Doorloop de volledige keten in docker-compose: bootstrap, huishouden-uitnodiging naar een tweede gebruiker, lid uitnodigen, wisselen, MCP `whoami` namens beide gebruikers; verifieer dat elke gebruiker alleen zijn eigen huishoudens ziet en dat `pnpm lint typecheck test test:e2e` slaagt

## Workflow follow-up

- Archiveer de change na review, zodat de specs `accounts`, `households`, `mcp-access`, `app-shell` en `deployment` in `openspec/specs/` landen.
- Volgende change: `catalog` (ingrediënten, eenheden, aliassen, zoeken).
