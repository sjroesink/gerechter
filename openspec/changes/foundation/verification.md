# Verificatie foundation

Gecontroleerd bij afronding van `foundation` op 5 november 2026; alle 36 implementatietaken waren toen afgerond. Dit is de historische foundationcontrole. De latere modules en de actuele eindcontrole staan in [`../../VERIFICATION.md`](../../VERIFICATION.md).

## Eisen en bewijs

| Taken | Eisen | Controle |
| --- | --- | --- |
| 1.1–1.4 | Project, tooling, laagindeling, git | `pnpm dev` serveert op `http://localhost:3000`; lint, typecheck, Vitest en Playwright slagen. `README.md` beschrijft de lagen en verwijst naar het ontwerp. `.gitignore` sluit configuratie, data en gegenereerde bestanden uit. |
| 2.1 | Configuratie via env en zod | `scripts/env.mjs` is het gedeelde schema. `src/lib/env.test.ts` controleert ontbrekende waarden en normalisatie. `tests/start.test.ts` controleert dat alle vijf ongeldige instellingen vóór migraties en serverstart worden afgekeurd. Ook de productiecontainer stopt direct bij een te kort geheim. |
| 2.2–2.4 | Drizzle, pg_trgm, Testcontainers, migraties bij opstarten | Een verse Postgres 17 krijgt de migraties automatisch. `tests/db.test.ts` controleert `select 1` en `pg_trgm`; `tests/start.test.ts` bewijst dat mislukte migraties de serverstart blokkeren. |
| 3.1–3.3 | Context, fouten, rollen en herbruikbare afscherming | `src/domain/core/ctx.test.ts`, `src/server/ctx.test.ts` en `tests/isolation.test.ts` controleren de rollen, ontbrekende sessie/huishouden en de afschermingshelper met twee huishoudens. |
| 4.1–4.3 | Auth-schema, uitnodigingen, registratieblokkade en bootstrap | `src/domain/accounts.test.ts` en `src/domain/invites.test.ts` controleren registratie zonder uitnodiging, bootstrap met het verkeerde adres, tweede bootstrap, geldigheid, verbruik en intrekken van uitnodigingen. De auth-migraties draaien tegen echte Postgres. |
| 4.4–4.7 | Accountpagina's, uitloggen, beheer en herstel | `e2e/01-onboarding.spec.ts` doorloopt setup, uitnodigingsregistratie, verlopen links, inlogfouten, uitloggen en herstel. Domeintests controleren beheerdersrechten, een nieuw huishouden met eigenaar, de hersteltermijn, eenmalig gebruik en het intrekken van sessies. |
| 5.1–5.4 | Lidmaatschap, minstens één eigenaar, wisselen en afscherming | `src/domain/households.test.ts` controleert rollen, verwijderen, verlaten, de laatste eigenaar, opgeslagen keuze en gemanipuleerde ID's. Uitnodigingstests controleren huishoudafscherming. Playwright controleert accepteren met een bestaand account, wisselen en de keuze na opnieuw inloggen. |
| 6.1–6.3 | Navigatie, lege staten, drill-down en beschermde pagina's | `e2e/02-shell.spec.ts` controleert de vier secties, actieve markering, terugnavigatie, directe links, login met terugkeer en toegang tot Beheer. |
| 6.4 | Alle pagina's bruikbaar op 360 px, aanraakdoelen minimaal 44×44 px | De gedeelde `expectMobileLayout` controleert zowel de acht app-pagina's als setup, login, de uitnodigingsvarianten, herstel en consent tijdens de bijbehorende flows. Ook extra browsercontexten gebruiken 360×780. De te kleine loginlink op de uitnodigingspagina is vergroot. |
| 7.1–7.2 | OAuth-discovery en toestemming | `e2e/03-mcp.spec.ts` controleert beide metadata-endpoints, PKCE-ondersteuning, login, toestaan en weigeren. De echte Claude Code-client heeft ook de CIMD-registratie en OAuth-flow doorlopen. |
| 7.3–7.4 | MCP-transport, gebruikerscontext en intrekken | `src/server/mcp/mcp.test.ts` controleert 401 zonder/ongeldig token, de uitdaging, tools/list, whoami, geen huishouden, directe afscherming na ledenverwijdering en 401 na intrekken. Playwright controleert verbonden apps en de eigen huishoudens van twee gebruikers. |
| 7.5 | Echte Claude Code-koppeling en whoami | Claude Code 2.1.301 verbonden met `http://localhost:3000/mcp` via `claude mcp login gerechter --no-browser`. Na OAuth voerde de client precies één `mcp__gerechter__whoami` uit. Resultaat: `beheer@e2e.test`, actief `Huishouden van Beheerder` met rol `owner`, en de twee eigen huishoudens. De modelaanroep gebruikte na toestemming de bestaande Claude-aanmelding. De tijdelijke MCP-aanmelding is daarna uitgelogd. Stappen staan in `README.md`. |
| 8.1 | Health-check | `src/server/health.test.ts` controleert 200 bij een bereikbare database en 503 bij een onbereikbare database. Ook de draaiende dev- en productieomgeving geven 200. |
| 8.2–8.4 | Container, compose, databehoud en handleiding | Node 24-productieimage gebouwd; app en Postgres 17 worden gezond. Een aparte compose-stack met een verse gegevensmap doorliep de onboarding. Alle tabelgegevens uit `pg_dump --data-only` zijn gelijk na `down` en `up` (afgezien van de willekeurige dumpbeveiligingsmarkeringen): drie accounts en twee huishoudens behouden. De laatste image met gedeelde env-validatie is opnieuw gebouwd en gezond gestart. `README.md` en `.env.example` beschrijven configuratie, starten, back-up en Unraid. |
| 9.1 | Volledige keten | De browsertests doorliepen ook de aparte compose-stack: bootstrap, nieuw huishouden, ledenuitnodiging, wisselen, OAuth en whoami voor beide gebruikers. De oorspronkelijke lokale database bleef leeg; de devserver is na de clientcontrole hersteld. |

## Uitgevoerde controles

- `pnpm lint`: geslaagd.
- `pnpm typecheck`: geslaagd.
- `pnpm test`: 63 tests geslaagd in 12 bestanden, tegen Testcontainers-Postgres.
- `pnpm test:e2e`: 21 tests geslaagd op de uiteindelijke implementatie.
- Compose: 20 ketentests plus de afzonderlijke OAuth-discoverytest geslaagd; databehoud na opnieuw aanmaken bevestigd.
- Productiecontainer: gezonde start en directe weigering van ongeldige configuratie bevestigd.
- `openspec validate --all --strict --no-interactive`: geslaagd.

De change blijft beschikbaar voor review en archivering; archiveren is de vervolgstap uit `tasks.md`.
