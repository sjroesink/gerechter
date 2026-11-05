# Gerechter

Recepten, voorraad en weekplanning voor huishoudens, met een MCP-server zodat AI-agents mee kunnen werken.

De architectuur en de keuzes daarachter staan in [`openspec/changes/foundation/design.md`](openspec/changes/foundation/design.md) (na archiveren: `openspec/specs/`).

## Snel starten (docker-compose)

```bash
cp .env.example .env
# Vul in .env minstens BETTER_AUTH_SECRET (openssl rand -base64 32) en ADMIN_EMAIL in.
docker compose up -d --build
```

Open http://localhost:3000. Bij de eerste start zie je de setuppagina: maak daar het eerste account aan met het
e-mailadres uit `ADMIN_EMAIL`. Dat account wordt platformbeheerder en krijgt een eigen huishouden. Daarna kan
niemand zich meer registreren zonder uitnodigingslink.

- **Nieuw huishouden**: Meer › Beheer › _Uitnodigingslink maken_ (alleen de beheerder).
- **Iemand aan je huishouden toevoegen**: Meer › Huishouden › _Uitnodigingslink maken_ (alleen eigenaren).
- **Wachtwoord vergeten**: de beheerder maakt onder Meer › Beheer een herstellink (24 uur geldig).

Links worden niet gemaild; je kopieert of deelt ze zelf. Ze zijn eenmalig te gebruiken.

## Configuratie

Alle instellingen komen uit omgevingsvariabelen; zie [`.env.example`](.env.example) voor uitleg per variabele.

| Variabele                         | Verplicht | Doel                                                      |
| --------------------------------- | --------- | --------------------------------------------------------- |
| `DATABASE_URL`                    | ja        | Postgres-verbinding (in compose automatisch gezet)        |
| `PUBLIC_BASE_URL`                 | ja        | Publieke URL; basis voor links en de MCP-resource         |
| `BETTER_AUTH_SECRET`              | ja        | Geheim voor sessies en tokens (min. 32 tekens)            |
| `ADMIN_EMAIL`                     | ja        | E-mailadres van de platformbeheerder voor de eerste setup |
| `PORT`                            | nee       | Poort van de app (standaard 3000)                         |
| `POSTGRES_PASSWORD`               | nee       | Wachtwoord van de Postgres-gebruiker in compose           |
| `APP_PORT`, `DB_PORT`, `DATA_DIR` | nee       | Alleen compose: poorten op de host en de datamap          |

Ontbreekt een verplichte variabele, dan stopt de app direct met een melding die de variabele noemt. Openstaande
databasemigraties worden bij elke start uitgevoerd; mislukt er een, dan start de app niet.

## Data en back-up

Alle blijvende gegevens staan in `./data` (instelbaar met `DATA_DIR`). Containers kun je zonder dataverlies
weggooien en opnieuw aanmaken. Een back-up is die map kopiëren terwijl de stack stilstaat, of:

```bash
docker compose exec db pg_dump -U gerechter gerechter > gerechter-backup.sql
```

`GET /health` geeft 200 als de app en de database bereikbaar zijn, anders 503.

## AI-agents koppelen (MCP)

De MCP-server staat op `/mcp` (Streamable HTTP) en vraagt altijd om OAuth: elke aanroep gebeurt namens een
gebruiker, in diens actieve huishouden. Koppelen met Claude Code:

```bash
claude mcp add --transport http gerechter http://localhost:3000/mcp
```

Start daarna Claude Code en kies bij `/mcp` de server _gerechter_ om in te loggen. Je browser opent de
inlogpagina en daarna een toestemmingsscherm; na _Toestaan_ kan de agent de tool `whoami` gebruiken. Verbonden
apps zie en trek je in onder Meer › Verbonden apps.

## Naar Unraid

Dezelfde `docker-compose.yml` werkt in Compose Manager. Verwachte stappen:

1. Image publiceren (bijv. GHCR) of op de server bouwen; in compose `build: .` vervangen door `image: …`.
2. `DATA_DIR` naar een share zetten (bijv. `/mnt/user/appdata/gerechter`) en de `ports`-regel van `db` weghalen.
3. `PUBLIC_BASE_URL` op het publieke subdomein zetten (https) en de app achter Traefik hangen.
4. Back-up: de appdata-map meenemen in de bestaande back-up van de server.

E-mail (uitnodigingen en herstel per mail) en rate limiting achter een proxy (`X-Forwarded-For`) horen bij die stap.

## Ontwikkelen

```bash
pnpm install
docker compose up -d db        # Postgres op localhost:5432
cp .env.example .env           # en invullen
pnpm db:migrate
pnpm dev                       # http://localhost:3000
```

| Commando                       | Wat                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `pnpm lint` / `pnpm typecheck` | ESLint + Prettier, TypeScript                                                                                      |
| `pnpm test`                    | Unit- en integratietests (Vitest, Postgres via Testcontainers; Docker nodig)                                       |
| `pnpm test:e2e`                | Playwright op 360 px tegen een productiebuild en een lege database `gerechter_e2e` (compose-Postgres moet draaien) |
| `pnpm db:generate`             | Nieuwe migratie uit het Drizzle-schema                                                                             |

Met `E2E_BASE_URL`, `E2E_DATABASE_URL` en `E2E_ADMIN_EMAIL` draait de e2e-suite tegen een al draaiende omgeving,
bijvoorbeeld een verse compose-stack.

## Laagindeling

```
src/
  domain/       Bedrijfsregels. Functies krijgen altijd een Ctx (gebruiker + huishouden) mee.
  db/           Drizzle-schema en client; migraties staan in drizzle/.
  auth/         Better Auth-configuratie (accounts, MCP-OAuth).
  server/       Adapters die een Ctx bouwen en de domeinlaag aanroepen (server functions, MCP, health).
  routes/       TanStack Router-routes: pagina's en server routes (/mcp, /health, /api/auth).
  components/   UI-componenten.
```

**Adapterpatroon.** UI (server functions), MCP en een eventuele latere REST-API zijn dunne lagen: ze valideren
invoer, bouwen een `Ctx` (`ctxFromSession` of `ctxFromMcpToken`) en roepen een domeinfunctie aan. Regels, rechten
en de afscherming tussen huishoudens leven alleen in `src/domain`; elke module heeft een afschermingstest
(`tests/isolation.ts`).
