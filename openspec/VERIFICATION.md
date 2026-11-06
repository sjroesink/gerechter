# Verificatie volledige Gerechter-app

Deze controle beschrijft de oorspronkelijke negen changes. Het latere verzoek voor ingrediëntfoto's
staat in [de aanvullende beeldverificatie](changes/ingredient-images/verification.md).

Gecontroleerd op 5 november 2026. Scope: het actieve doel, de overall architectuur in
`changes/foundation/design.md`, alle specificaties/taken van de negen changes en de aanvullende opdracht
voor tien gerechten en een voorbereide week via MCP. De onderstaande controles betreffen de huidige
implementatie; de eerdere modulecijfers in `ROADMAP.md` blijven historische tussenstanden.

## Uitgevoerde controles

- `pnpm lint` en `pnpm typecheck`: geslaagd.
- `pnpm test`: **192 tests in 26 bestanden** geslaagd, met Postgres via Testcontainers.
- `pnpm test:e2e`: **43 tests** geslaagd op 360×780, tegen productiebuild, afzonderlijke database
  `gerechter_e2e` en gecontroleerde AH-ASGI-service. De echte lokale database is hierbij niet gewist.
- `uv run --project sidecar pytest sidecar/tests -q`: **16 tests** geslaagd.
- `uv run --project sidecar ruff check sidecar` en `ruff format --check sidecar`: geslaagd.
- `openspec validate --all --strict`: alle **negen changes** geldig.
- `git diff --check`: geslaagd. `.env`, testdata, lokale helpers en Python-virtualenv zijn genegeerd.
- `pnpm db:migrate`: geslaagd op de bestaande lokale database; additieve migraties t/m 0008 aanwezig.
- `pnpm dev --strictPort`: gestart op poort 3000 met lokale `.env` en alle netwerkinterfaces.
  `pnpm start`: daarnaast gecontroleerd op poort 3150 met uitsluitend de testdatabase.
- `docker compose build app`: actuele Node 24-runtime gebouwd. Tijdelijke appcontainer met de bestaande
  testdatabase en compose-netwerk gezond; `/health` gaf 200. Daarna opgeruimd.
- `docker compose -f docker-compose.yml -f docker-compose.ah.yml config --quiet` en
  `up -d --build ah`: geslaagd. Sidecar draait gezond op loopbackpoort 3001; serverauth en aanmeldinfo
  gecontroleerd zonder AH-account aan te melden.
- `http://main-pc:3000/health` en `/login`: 200. Ook localhost en sidecarhealth: 200.

De lokale startcommando's lezen een aanwezige `.env` met Node; bestaande omgevingsvariabelen houden
voorrang. Na toevoeging van de AH-configuratie is de devserver herstart en de werkelijke instellingenpagina
opnieuw in de browser gecontroleerd.

## Scope en bewijs per onderdeel

| Onderdeel / specificaties | Gecontroleerd gedrag | Bewijs in huidige implementatie en tests |
| --- | --- | --- |
| Accounts | Bootstrap, alleen uitnodigingsregistratie, geldigheid/verbruik, beheer, herstel en sessie-intrekking | `accounts.test.ts`, `invites.test.ts`, `e2e/01-onboarding.spec.ts`; echte lokale adminlogin met het op verzoek gewijzigde wachtwoord slaagt |
| Huishoudens | Rollen, minstens één eigenaar, ledenbeheer, gedeelde keuze, directe intrekking en afscherming | `households.test.ts`, `core/ctx.test.ts`, `server/ctx.test.ts`, OAuth-integratietests en e2e 01/03 |
| Schil / thema | Vier secties, Meer, directe URLs, terugnavigatie, bescherming, 360 px en minimaal 44×44 px, standaard systeemthema | e2e 02/04 en `expectMobileLayout` in moduleflows; echte lokale mobiele browser met systeemdonker en zonder browserfouten gecontroleerd |
| Deployment | Envvalidatie, migraties vóór start, fout bij mislukte migratie, health 200/503 en data buiten containers | `env.test.ts`, `start.test.ts`, `db.test.ts`, `health.test.ts`, actuele Docker-build/runtime; eerdere foundation-containervanging met datavergelijking in `changes/foundation/verification.md` |
| MCP-toegang | OAuth, PKCE, consent, challenge zonder token, identiteit en intrekken | `server/mcp/mcp.test.ts`, e2e 03; bestaande echte Codex OAuth-aanmelding werkt en ontdekt 43 tools. Historische Claude Code-whoami ook geverifieerd in foundation |
| Ingrediëntencatalogus | Globaal/eigen, beheerdersrechten, namen/aliassen en fuzzy zoeken, unieke namen, onveranderlijke basiseenheid en archief | `catalog.ts` / `catalog.test.ts`, e2e 05, OAuth-catalogustests; aangepaste privé-IDs blijven ook voor admins verborgen |
| Eenheden | Massa/volume/aantal/vaag, vaste verhoudingen, ingrediëntconversies en expliciet onbekende verhoudingen | `units.ts` / `units.test.ts`, catalogustests; kg/l/tl/el, dichtheid, containers en weigeren van exacte vage omrekeningen gecontroleerd |
| Gerechten | Metadata en echte ingrediënten, lineaire porties, naam/tags zoeken, archiveren/herstellen, volledige atomaire versiegestuurde bewerkingen | `recipes.ts` / `recipes.test.ts`, e2e 06 en MCP-recepttests; alle tien echte MCP-gerechten teruggelezen |
| Instructies | Vaste secties, afgeleide ingrediënten, beperkte OpenUI, complete validatie, lokale timer/checklist en agentdocumentatie | `instructions.test.ts`, `openui-block.tsx`, e2e 06 en `get_instruction_format`; dynamische/externe inhoud geweigerd, timer start/pauze/herstel en checklist getest |
| Voorraad / basisvoorraad | Exacte telling apart van altijd-in-huis, bekende conversies, versie/audit, verwijderen zonder historieverlies, archief en afscherming | `pantry.test.ts`, e2e 07 en MCP-voorraadtests; andere huishoudens delen geen telling of mutaties |
| Huishoudporties | Default 2, geheel 1–1000, expliciete overschrijving, geen receptmutatie | `pantry.test.ts`, e2e 07, voorkeurtools; werkelijke voorkeur 2 via MCP gelezen |
| Planning | Maandag–zondag, kalenderdagen/DST/jaargrens, meerdere items, vrije tekst, porties, verplaatsen/verwijderen, archief en conflicten | `calendar.test.ts`, `planning.test.ts`, e2e 08 en MCP-planningtests; echte week 9–15 november teruggelezen en visueel gecontroleerd |
| Gemaakt / beoordelingen | Expliciet voorstel en bevestiging, historische momentopname, eigen beoordeling, aanpasbare exacte afboeking, nooit negatief, rollback en herhaalveiligheid | `cooking.test.ts`, e2e 09 en MCP-kooktests; vage/ontbrekende omrekeningen stellen nul voor, andermans beoordeling blijft apart |
| Boodschappenbehoefte | Gerecht/dag/week, bekende totalen, voorraad eenmaal, basisvoorraad apart, onbekende delen zichtbaar, vrije/gemaakte planning uitsluiten en actueel voorstel vereisen | `shopping-needs.test.ts`, `shopping-sync.test.ts`, e2e 10; echte voorbereide week levert zeven bronmaaltijden en 39 controleerbare lijstregels via read-only MCP |
| Delen / Notion / SyncRun | Tekstfallback, eerlijke deelstatus, versleutelde ownerverbinding, ledengebruik, snapshots/bronclaims, herhaalkeuze en read-only onzekerheidsherstel | `shopping-sync.test.ts`, `shopping-secrets.test.ts`, `notion.test.ts`, e2e 10 en MCP-boodschappentests; ook herstel van dezelfde Notion-bestemming en bescherming na mislukte herhaling getest |
| AH-sidecar | Per-verbindingauth/encryptie, echte client en refresh, duurzame jobs/regelstatus, dubbele aanvragen, geen schrijfretries, gedeeltelijke fouten en herstart | 16 Python-tests met echte python-appie 0.2.2 en HTTPX MockTransport; `ah.test.ts`, `ah-setup.test.ts`, shoppingdomeintests en drie e2e 11-flows via echte ASGI-service |
| Agentwerkwijzer / huishoudwissel | Alle toolgroepen beschreven, gedeelde voorkeur, actuele rechten per call, geen oude privé-IDs na wisselen of intrekking | OAuth-integratietests vergelijken alle 43 tools met de werkwijzer en initialize-instructies; e2e 03 wisselt via MCP, vernieuwt webapp, weigert vreemde ID en wisselt terug via UI |

Alle inhoudelijke adapters roepen dezelfde domeinfuncties aan. Reads en writes gebruiken de actuele
`Ctx` met huishouduitsluiting; de testdekking bevat zowel domein-, OAuth/MCP- als browseraanroepen.
De sidecar heeft geen productie-testmodus en geen globale gedeelde AH-tokenfile.

## Werkelijke MCP-oplevering

Actief huishouden: `18f2207f-1a40-416a-ba3c-76ee038d5f09` (Huishouden van Sander Roesink), owner.
Toevoegen en plannen gebeurden via de bestaande aangemelde Codex-MCP-client, zonder modelaanroep of
rechtstreekse database-inserts. Eerst kandidaten gezocht en passende ingrediënten hergebruikt.
De oorspronkelijke week was leeg. Een nieuwe MCP-sessie las op 5 november om 15:46 UTC alle tien
gerechten met ingrediënten en drie vaste instructiesecties terug, plus de zeven geplande dagen.

| Gerecht | Recept-ID |
| --- | --- |
| Pasta met tomatensaus | `7de956d6-be09-44bb-8c0c-fea740e31a89` |
| Kikkererwtencurry met spinazie | `7d2f58fb-c31d-457c-a890-e2cd0d1006ff` |
| Groenteomelet | `2c28518b-ac1b-4e4b-945b-5937dab7d2ac` |
| Citroenrijst met zalm en broccoli | `e0176010-30f7-4777-a672-62dfbdac1987` |
| Volkoren wraps met kip en paprika | `f958771a-f85d-4079-935f-22bbbe666795` |
| Chili sin carne met rijst | `11708034-508c-4eca-b926-c944cd24deab` |
| Ovenplaat met aardappel, wortel en kikkererwten | `ec09cea1-1d14-4d70-8635-03a34ef2a9b4` |
| Linzenbolognese met volkoren spaghetti | `5809e9bc-65d9-4237-9dc7-62f816d5ed9f` |
| Couscous met geroosterde groenten en feta | `684ee9d1-75a4-4369-9837-240b7ffdff39` |
| Volkoren noedels met tofu en wokgroenten | `d5d8a619-2b0f-4667-9785-d8b5a1d3b2c7` |

De eerste drie voorbeelden zijn behouden; zeven toegevoegd. De tien gerechten zijn ook in de echte
webapp teruggevonden. De lokale admincontrole gebruikte alleen een tijdelijke browsersessie en logde
die daarna uit. Een mobiele screenshot van de volledige donkere week is lokaal vastgelegd.

| Datum | Avondmaaltijd (2 porties via huishoudstandaard) | Planning-ID |
| --- | --- | --- |
| ma 9 november | Pasta met tomatensaus | `7b7333af-ef1d-4a5a-a714-30961e80dd5a` |
| di 10 november | Volkoren wraps met kip en paprika | `b5f3c224-fdd2-471e-a4d9-bd817239acc0` |
| wo 11 november | Kikkererwtencurry met spinazie | `117d6f14-ccf5-4049-b823-1c3e094dfe2b` |
| do 12 november | Citroenrijst met zalm en broccoli | `67ce6199-e614-4cb8-9a3f-986d7081f07a` |
| vr 13 november | Chili sin carne met rijst | `5bde91e7-cd7c-49a5-832d-edde6c9abdd0` |
| za 14 november | Ovenplaat met aardappel, wortel en kikkererwten | `ea1fc540-0ff7-4ffc-9959-997a4552802f` |
| zo 15 november | Volkoren noedels met tofu en wokgroenten | `6b2ce380-99fa-4a09-9c42-c86a040ae8d0` |

Open de week op [main-pc:3000](http://main-pc:3000/week?week=2026-11-09).
Er zijn geen eerdere maaltijden overschreven, bereidingen geregistreerd, voorraadmutaties gemaakt of
boodschappen extern geëxporteerd voor deze voorbeeldoplevering. Eetvoorkeuren zijn opgevraagd;
zonder aanvullende voorkeur is een gevarieerd concept met vijf dagen zonder vlees of vis, één kipdag en één visdag gemaakt.

## Grenzen van de providercontrole

Bij de oorspronkelijke eindcontrole meldde de echte MCP-leesactie Notion en AH als **niet gekoppeld**.
De eigenaar heeft AH later gekoppeld. Na een geweigerde export is het tekstregelcontract gecorrigeerd;
de bestaande live verbinding is succesvol uitgelezen en de sidecar opnieuw gebouwd. De nieuwe controles
omvatten 23 Python-tests en 10 gerichte Node-contracttests. Er is geen nieuwe live export gestart.
Zie [de aanvullende verificatie](changes/ah-sidecar/verification.md) voor bewijs en beperkingen.

Notion is gecontroleerd met request-/responsecontracten, inclusief paginering, limieten, fouten en een
verwerkte write zonder normaal antwoord. AH gebruikt de echte client met gecontroleerd transport en
een echte testservice. Dit is geen bewijs van live Notion- of AH-accountgebruik. Er zijn geen live
providerwrites uitgevoerd en er is niets besteld.

De wijzigingen blijven ongecommit en de afgeronde OpenSpec-changes blijven beschikbaar voor review.
Archiveren met synchronisatie naar hoofd-specs is de vastgelegde vervolgstap na review.
