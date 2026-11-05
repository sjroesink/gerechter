# Proposal

## Why

Gerechter wordt een app voor recepten, voorraad en weekplanning die meerdere huishoudens kan bedienen en waar AI-agents via MCP aan kunnen bijdragen. Voordat er ook maar één gerecht kan worden toegevoegd, is een fundament nodig: een draaiende app, accounts, huishoudens als afgeschermde eenheid (tenant), een beveiligd MCP-endpoint en een mobiele navigatieschil. Dit is de eerste van negen geplande changes; alle volgende changes (catalogus, gerechten, instructies, planning, gemaakt/beoordelingen, boodschappen-sync, MCP-tools, AH-sidecar) bouwen hierop voort.

## What Changes

- Nieuwe webapplicatie (TanStack Start) met een mobile-first navigatieschil: tabbladen voor Week, Gerechten, Voorraad en Meer, en drill-down pagina's met weinig informatie per scherm. De secties zelf tonen nog een lege staat; de inhoud komt in latere changes.
- Accounts met e-mail + wachtwoord. **Geen open registratie**: een account aanmaken kan alleen via een uitnodiging, of eenmalig door de vooraf geconfigureerde beheerder bij de eerste start.
- Een platformbeheerder-rol (nodig voor het latere beheer van de globale ingrediëntencatalogus) die nieuwe huishoudens kan uitnodigen.
- Huishoudens als tenant: leden met rol eigenaar of lid, uitnodigen via een deelbare link (geen e-mailserver nodig), een actief huishouden per gebruiker, en strikte afscherming van huishoudgegevens.
- Een MCP-endpoint dat alleen met OAuth-autorisatie bereikbaar is en altijd namens een gebruiker binnen diens actieve huishouden handelt. In deze change bevat het alleen een diagnostische tool die laat zien wie er is ingelogd; de inhoudelijke tools komen in change 8.
- Een domeinlaag als enige plek voor bedrijfsregels. UI (server functions), MCP en een eventuele latere REST-API zijn dunne adapters erbovenop.
- Lokaal draaien met docker-compose (app + Postgres), alle configuratie via omgevingsvariabelen, alle data in een volume, automatische databasemigraties en een health-endpoint, zodat de overstap naar Unraid later geen herontwerp vraagt.

Buiten scope: ingrediëntencatalogus en eenheden, gerechten, instructies/OpenUI, planning, gemaakt-flow en beoordelingen, boodschappen-sync, inhoudelijke MCP-tools, AH-sidecar, e-mailverzending, publieke REST-API, open registratie, uitrol naar Unraid.

## Capabilities

### New Capabilities

- `accounts`: gebruikersaccounts, inloggen/uitloggen, registratie uitsluitend via uitnodiging, eenmalige bootstrap van de platformbeheerder en wachtwoordherstel zonder e-mail.
- `households`: huishoudens als tenant, lidmaatschap en rollen, uitnodigingslinks, actief huishouden en de afscherming van gegevens tussen huishoudens.
- `mcp-access`: het MCP-endpoint, OAuth-autorisatie voor agents, en de regel dat elke MCP-aanroep namens een gebruiker in een huishouden wordt uitgevoerd.
- `app-shell`: de mobile-first navigatiestructuur (tabbladen, drill-down, terugnavigatie) en de toegangsregels voor pagina's.
- `deployment`: draaien via docker-compose, configuratie via omgevingsvariabelen, persistente data, migraties bij opstarten en een health-check.

### Modified Capabilities

(geen; dit is de eerste change)

## Impact

- Nieuwe codebase in deze repository (nu alleen `openspec/` en tooling-configuratie).
- Nieuwe afhankelijkheden: TanStack Start (React), Postgres, Drizzle ORM, Better Auth (organisaties, JWT, MCP/OAuth), de officiële MCP TypeScript SDK, Tailwind CSS, Vitest en Playwright.
- Nieuwe runtime-onderdelen: app-container en Postgres-container in `docker-compose.yml`, een `.env.example` en een datavolume.
- Legt conventies vast waar latere changes van afhangen: tenant-scoping via een contextobject in de domeinlaag, adapterstructuur, migratieworkflow en teststrategie.
