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

## Ingrediënten en eenheden

Onder Meer › Ingrediënten zoek je op naam of andere namen, voeg je eigen ingrediënten toe en beheer je
omrekeningen. Als platformbeheerder kun je bij het aanmaken ook kiezen voor alle huishoudens; globale
ingrediënten zijn voor gewone gebruikers alleen leesbaar. Archiveren verbergt een ingrediënt bij het zoeken,
maar behoudt bestaande verwijzingen. Met ‘Inclusief archief’ kun je het terugvinden en herstellen.

Een ingrediënt heeft een vaste basiseenheid: gram (`g`), milliliter (`ml`) of stuk (`stuk`). Kilogram en liter
rekenen automatisch om naar gram en milliliter; een theelepel is 5 ml en een eetlepel 15 ml. Voor een blik,
pak, teen, bos of plak geef je zelf de verhouding voor dat ingrediënt op. Een verhouding van 1 liter olie
naar 900 gram wordt bewaard als 1 ml = 0,9 g en werkt ook voor eetlepels. Onbekende verhoudingen blijven
onbekend. Een snuf, handje of scheut wordt nooit automatisch een exacte hoeveelheid.

De catalogus is ook via MCP beschikbaar: `list_units`, `search_ingredients`, `get_ingredient`,
`create_ingredient`, `update_ingredient`, `set_ingredient_archived`, `set_ingredient_conversion` en
`remove_ingredient_conversion`. Zoek eerst een passende kandidaat en hergebruik het ingrediënt-ID voordat
je iets nieuws aanmaakt. De tools gebruiken steeds het actieve huishouden van de aangemelde gebruiker.

Een ingrediënt kan een eigen afbeelding hebben. Open de ingrediëntpagina, kies Gegevens wijzigen en
vul onder Afbeelding een directe Foto-URL in. Bronpagina, fotograaf/bron en licentie- of voorwaardenlink
blijven bij de foto bewaard en staan op de detailpagina. Thumbnails verschijnen ook in de catalogus,
ingrediëntkiezer, voorraad, ingrediëntenlijst van een gerecht en boodschappenoverzicht. Een onbereikbare foto krijgt een neutrale
vervanging. Wis de Foto-URL om een foto te verwijderen. Voor globale foto's gelden dezelfde beheerdersrechten
als voor de rest van het globale ingrediënt.

MCP accepteert bij `create_ingredient` en `update_ingredient` optioneel `photo` met `url`, `sourceUrl`,
`credit` en `licenseUrl`. URL-velden zijn HTTP(S), zonder aanmeldgegevens; bron/credit/voorwaarden mogen
null zijn. Bij wijzigen betekent `photo` weglaten dat de foto behouden blijft en `photo: null` dat zij wordt
gewist. Lees voor een wijziging steeds de bestaande naam en aliassen om die te behouden.

Voor recepten met gerechtfoto's en losse ingrediëntbeelden biedt [TheMealDB](https://www.themealdb.com/docs_api_guide.php)
een gratis API voor persoonlijke projecten en ontwikkeling. De bron is Engelstalig; ingrediënten worden
bewust aan een Nederlandse catalogusnaam gekoppeld. De lokale voorbeeldbeelden verwijzen naar de officiële
afbeeldingsendpoints, met bron en [gebruiksvoorwaarden](https://www.themealdb.com/terms_of_use.php).
Dit is geen algemene open licentie: voor publieke uitrol of appstores gelden andere voorwaarden. Sommige
ingrediëntbeelden tonen een voorbeeldverpakking; dit bepaalt geen merk, product of voedingswaarde in Gerechter.
Voor volkorenvarianten zonder specifieke bronfoto staat in de bronvermelding dat het een algemene illustratie is.

[Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) is een
alternatief voor vrij herbruikbare foto's. Controleer per bestand de auteur en licentie en bewaar de vereiste
vermelding en link. De foto van knoflooktenen gebruikt bijvoorbeeld een gecontroleerde publiek-domeinfoto
van Jon Sullivan. Gerechtfoto's kun je al bij een recept met Foto-URL instellen; de ingrediënten blijven
apart herkenbaar. De app importeert met deze beeldfunctie geen volledige externe receptenbank.

## Gerechten en instructies

Onder Gerechten maak je een recept met porties, metadata, tags en ingrediënten uit de catalogus.
Hoeveelheden mogen leeg blijven voor ‘naar smaak’. De portiekeuze op de detailpagina schaalt alleen de
weergave; bij bewerken blijft het opgeslagen aantal porties staan. Zoeken werkt op naam en tags.
Archiveren verbergt een gerecht uit de actieve lijst, met behoud van inhoud en verwijzingen. Via
‘Inclusief archief’ vind je het terug en kun je het herstellen. Gelijktijdige wijzigingen worden met een
versie gecontroleerd: open bij een conflict de nieuwste versie voordat je opnieuw opslaat.

Instructies hebben vier vaste secties: Voorbereiding, Bereiding, Serveren en Notities. Naast gewone tekst
kun je stappen, tips, kookwekkers en checklists toevoegen. De ingrediëntensectie komt altijd uit de echte
receptregels. Timers en afgevinkte taken zijn lokaal en worden bij het opnieuw openen teruggezet.

MCP biedt `search_recipes`, `get_recipe`, `create_recipe`, `update_recipe`, `set_recipe_archived`, `fetch_recipe_from_url` en
`get_instruction_format`. Vraag het formaat op voordat je OpenUI-inhoud maakt. De toegestane componenten
zijn `RecipeSteps`, `Step`, `Tip`, `Timer` en `Checklist`; onvolledige inhoud, dynamische expressies,
queries, mutaties en externe acties worden bij het opslaan geweigerd. Voor wijzigen stuur je de volledige
gewenste inhoud en de actuele `version`. `get_recipe` retourneert de opgeslagen `quantity`, de voor
`viewServings` geschaalde `scaledQuantity` en een `baseQuantity` als een exacte omrekening bekend is.

### Recepten importeren van een URL

Geef een agent een receptlink. `fetch_recipe_from_url` haalt de pagina op en leest de schema.org-gegevens
(JSON-LD) uit tot een concept: naam, porties, tijden, ruwe ingrediëntregels, stappen, afbeelding en de
uiteindelijke bron-URL. Er wordt dan nog niets opgeslagen. Heeft het huishouden al een gerecht met die bron,
dan staat dat in `existingRecipe`. Zonder gestructureerde gegevens krijgt de agent de paginatekst. De agent
koppelt de regels aan de catalogus en slaat op met `create_recipe`, met `sourceUrl` en `photoUrl`. De
detailpagina linkt naar de bron.

Bij het opslaan van een gerecht met een nieuwe of gewijzigde foto-URL bewaart de server een eigen kopie van
de afbeelding in de database. Dat geldt voor de app en voor MCP. Toegestaan zijn JPEG, PNG, WebP, GIF en
AVIF tot 8 MB. De kopie staat op `/afbeeldingen/<id>` en is alleen zichtbaar voor leden van het huishouden.
`photoUrl` blijft de verwijzing naar het origineel. Lukt het downloaden niet, dan wordt het gerecht toch
opgeslagen en meldt het resultaat `photoWarning`. Bestaande gerechten houden hun gekoppelde foto tot je de
foto-URL wijzigt.

Uitgaande verzoeken gaan alleen naar publieke adressen via http(s) op poort 80 of 443. Interne en privéadressen
worden geweigerd, ook na DNS en redirects. Er gelden maximaal vijf redirects, tien seconden, 3 MB per pagina
en 8 MB per afbeelding. Sommige sites, zoals AH Allerhande, weigeren geautomatiseerde verzoeken. Een agent
met eigen webtoegang leest de pagina dan zelf en slaat op dezelfde manier op. Geïmporteerde recepten en foto's
zijn bedoeld voor persoonlijk gebruik binnen het huishouden.

## Voorraad, basisvoorraad en porties

Onder Voorraad kies je een ingrediënt uit de catalogus en tel je de volledige hoeveelheid die je in huis
hebt. De interface gebruikt gram, milliliter of stuk, passend bij het ingrediënt. Via MCP kun je ook een
bekende omrekening gebruiken. Onbekende of vage eenheden worden bij een exacte telling geweigerd.
Een getelde hoeveelheid kan maximaal 1.000.000.000.000 basiseenheden zijn.

‘Basisvoorraad: altijd in huis’ is een afzonderlijke keuze: de app veronderstelt bij boodschappen dat dit
ingrediënt aanwezig is, zonder daar een hoeveelheid aan toe te kennen. De exacte telling blijft apart
staan. Op de detailpagina kun je corrigeren, een reden en notitie opgeven en de laatste honderd mutaties
met persoon en tijd terugzien. ‘Uit voorraad verwijderen’ zet de telling op nul en basisvoorraad uit;
via ‘Ook lege en verwijderde regels’ blijft de historie bereikbaar. Bij gelijktijdig tellen krijg je een
conflict en moet je eerst de nieuwste telling openen.

Meer › Huishouden bevat de gedeelde standaardporties (standaard 2). De receptdetailpagina gebruikt die
voorkeur tenzij je zelf andere porties kiest. Het opgeslagen recept behoudt zijn oorspronkelijke porties.

MCP-tools: `get_pantry`, `get_pantry_item`, `set_pantry_item`, `remove_pantry_item`, `get_pantry_history`,
`get_household_preferences` en `set_household_preferences`. Lees vóór een telling `get_pantry_item` en
stuur de actuele `version` mee; een nog niet getelde regel heeft versie 0. `set_pantry_item` vervangt de
volledige telling, telt niet op en vereist ook de gewenste `staple`-keuze. Elke tool gebruikt het actieve
huishouden van de gebruiker.

## Weekplanning

De Week-tab toont maandag tot zondag. Met Vorige/Volgende week of de datumkeuze open je een andere week.
Open een dag om meerdere gerechten of vrije items zoals Restjes en Bestellen te plannen. Vanuit een recept
kun je ook ‘Dit gerecht plannen’ kiezen. Iedere maaltijd heeft een datum en optionele notitie.

Een leeg portieveld gebruikt steeds de actuele huishoudstandaard; een ingevuld aantal geldt voor die
maaltijd. Op de maaltijdpagina zie je de geschaalde ingrediënten en kun je de bereiding openen. Vrije items
hebben geen ingrediënten. Wijzig de datum om een item te verplaatsen. Verwijderen haalt het uit de actieve
planning maar behoudt de interne verwijzing. Gearchiveerde gerechten blijven in bestaande planning
leesbaar en verplaatsbaar; nieuw inplannen kan alleen met een actief gerecht. Bij een versieconflict open
je de nieuwste maaltijd voordat je opnieuw wijzigt.

MCP-tools: `get_week_plan`, `get_day_plan`, `get_planned_meal`, `create_planned_meal`, `update_planned_meal`
en `remove_planned_meal`. Datums zijn echte kalenderdagen in `YYYY-MM-DD`, zonder tijdzone. Gebruik
`kind: "recipe"` met `recipeId` en optionele `servings` (null = huishoudstandaard), of `kind: "free"` met
`title`. Wijzigen vraagt `mealId` en een `input` met de volledige gewenste inhoud en actuele `version`;
verwijderen vraagt `mealId` en `version`. Controleer eerst de bestaande dagplanning om dubbele items te
voorkomen. Alle acties gebruiken het actieve huishouden.

## Gemaakt, afboekingen en beoordelingen

Kies bij een recept of geplande maaltijd ‘Gemaakt registreren’. Controleer eerst de werkelijk gemaakte
porties; ‘Voorstel voor deze porties’ haalt een nieuw voorstel op en vervangt je concept. Vul de datum en
eventueel je eigen cijfer (geheel 1–10) en notitie in. Controleer daarna per ingrediënt hoeveel je werkelijk
uit de getelde voorraad wilt afboeken. Een nul boekt niets af. Bij vage of ontbrekende omrekeningen is het
voorstel nul; alleen een bewust zelf ingevulde, bekende basishoeveelheid kan dan worden afgeboekt.

‘Gemaakt bevestigen’ slaat de bereiding, eventuele beoordeling en alle afboekingen samen op. Voorraad
wordt nooit negatief. Is een relevante telling, receptversie of geplande maaltijd veranderd, dan krijg je
een conflict en moet je ‘Actueel voorstel ophalen’ gebruiken. Bij een netwerkfout mag je dezelfde
bevestiging opnieuw versturen: de verzoeksleutel voorkomt een dubbele bereiding of afboeking.

Meer › Gemaakt toont de geschiedenis. Elke bereiding bewaart de receptnaam, ingrediënten en instructies
van dat moment, ook na latere wijzigingen of archivering. Alle leden kunnen eigen cijfers en notities
toevoegen; je kunt alleen je eigen beoordeling wijzigen of wissen. Beoordelen verandert geen voorraad.
De detailpagina toont ook de werkelijk bevestigde afboekingen. Een verkeerde telling herstel je via de
normale voorraadcorrectie, zodat de eerdere mutaties zichtbaar blijven.

MCP-tools: `prepare_cooking`, `record_made`, `search_cooking_history`, `get_made_event` en
`set_my_made_rating`. Vraag eerst het voorstel op en bevestig de gekozen afboeklijst bewust met de
gebruiker. Bewaar `requestId`, de recept-/planningversies en de `pantryVersion` per regel. Gebruik bij een
netwerkherhaling exact dezelfde inhoud en sleutel. `set_my_made_rating` gebruikt altijd de aangemelde
persoon; `score: null` met lege `note` wist alleen diens eigen beoordeling.

## Boodschappen en exporthistorie

Open Meer › Boodschappen of gebruik de boodschappenknop bij een gerecht, dag of week. De lijst schaalt
porties, telt bekende basishoeveelheden op en trekt de getelde voorraad één keer af. Basisvoorraad en
voldoende getelde voorraad staan apart. Vrije en reeds gemaakte geplande maaltijden tellen niet opnieuw
mee. Een rechtstreeks gekozen gerecht kun je wel opnieuw berekenen. Vage hoeveelheden en ontbrekende
omrekeningen blijven herkenbare controlepunten; de app verzint geen grammen of verpakkingsgroottes.

Met ‘Lijst klaarzetten om te delen’ maak je een export met de gecontroleerde tekst. Op de exportpagina
kun je kopiëren of het deelmenu van je apparaat gebruiken. Als automatisch kopiëren niet beschikbaar is,
blijft de tekst selecteerbaar en kun je na handmatig kopiëren het resultaat bevestigen. Een geannuleerd
deelmenu krijgt status Geannuleerd. Gekopieerd en Deelmenu afgerond bevestigen alleen de lokale actie,
zonder ontvangst bij iemand anders te suggereren.

Een huishoudeigenaar stelt Notion in onder Boodschappen › Verbindingen: maak een verbinding met lees- en
invoegrechten, geef deze toegang tot een ouderpagina en vul het token en de pagina-ID in. Gebruik de
UUID uit de paginalink, met streepjes. De app maakt per bevestigde export één checklistpagina onder die
ouderpagina. Er wordt niets verzonden bij alleen het opslaan van de verbinding. Zie de officiële uitleg
over [Notion-verbindingen](https://developers.notion.com/guides/connections-and-tokens/overview) en
[toegang tot pagina's](https://developers.notion.com/reference/capabilities).

Het Notion-token wordt met AES-256-GCM versleuteld en aan het huishouden gebonden. Leesacties tonen het
token nooit. Bewaar voor herstel dezelfde `BETTER_AUTH_SECRET` bij je databaseback-up; na vervangen van
die sleutel moeten verbindingstokens opnieuw worden opgeslagen. Leden kunnen een ingestelde verbinding
gebruiken, maar alleen eigenaren kunnen haar wijzigen of verwijderen.

Exporthistorie bewaart bronkeuze, oorspronkelijke lijst, persoon, doel, tijd en resultaat. Een dag en een
week delen bronverwijzingen voor dezelfde geplande maaltijden: overlap wordt standaard geweigerd. Kies
alleen bewust ‘opnieuw exporteren’ als je de lijst nogmaals wilt toevoegen. Een losse receptkeuze is een
afzonderlijke bron. Annuleren of afwijzen van een herhaling bewaart de bescherming van eerdere exports.
Een gewijzigde behoefte vraagt eerst een actueel voorstel. Een netwerkherhaling met dezelfde
verzoeksleutel start geen tweede verzending.

Bij een onzekere Notion-uitkomst wordt niet automatisch opnieuw geschreven. ‘Extern resultaat
controleren’ zoekt met leesaanvragen naar de bestaande pagina. Pas na een volledige statuscontrole kun
je bewust opnieuw exporteren als er geen pagina is teruggevonden. Grote Notion-exports worden vooraf
op de officiële array-, blok- en requestlimieten gecontroleerd; verklein zo nodig de selectie.

MCP-tools: `prepare_shopping`, `get_shopping_targets`, `start_shopping_export`, `confirm_shopping_share`,
`list_shopping_exports`, `get_shopping_export` en `check_shopping_export`. Gebruik `source`, `requestId`
en `fingerprint` uit het voorstel en exporteer alleen op expliciete opdracht. Een deelresultaat bevestig
je pas na de werkelijke lokale actie. Notion-tokens stel je in de webinterface in.

Providerverificatie: request-/responsecontracten, paginering, limieten, afwijzingen en onzekere resultaten
zijn getest zonder live Notion-writes. Een live accountcontrole vereist een ingestelde eigen verbinding.

## Albert Heijn (experimenteel)

De optionele Python-sidecar gebruikt [python-appie 0.2.2](https://pypi.org/project/python-appie/0.2.2/).
Dit is een onofficiële API: de koppeling kan uitvallen als AH iets wijzigt. Gerechter voegt uitsluitend
tekstregels aan je boodschappenlijst toe. Productkeuze, winkelmandje en bestellen doe je zelf in AH.

Zet in `.env` een willekeurig `AH_SIDECAR_SECRET` van minstens 32 tekens (bijvoorbeeld met
`openssl rand -base64 32`) en `AH_SIDECAR_URL=http://127.0.0.1:3001`. Start voor lokale ontwikkeling:

```bash
docker compose -f docker-compose.yml -f docker-compose.ah.yml up -d --build ah
```

Start de webapp daarna met `pnpm dev`. Voor de hele compose-stack gebruik je hetzelfde commando zonder
`ah` aan het einde; de override laat de app intern `http://ah:8000` gebruiken. De hostpoort van de sidecar
bindt alleen aan `127.0.0.1`. `GET http://127.0.0.1:3001/health` controleert de service, zonder accountdata.
Alle andere endpoints vereisen het servergeheim; iedere verbinding heeft bovendien een eigen sleutel.
Zonder de twee optionele instellingen blijven Delen en Notion werken.

Een eigenaar opent Meer › Boodschappen › Verbindingen en kiest ‘Aanmelden bij AH’. Meld je in dat nieuwe
tabblad aan bij AH en plak de ontvangen `appie://login-exit?...`-adresregel of de code in Gerechter, ook
als de browser die callback niet opent. Je AH-wachtwoord vul je alleen bij AH in. Aanmelden verstuurt geen
boodschappen. Leden kunnen de ingestelde verbinding daarna gebruiken bij een gecontroleerd voorstel.
Loskoppelen verwijdert de appreferentie en probeert de opgeslagen AH-tokens te wissen; bij een onbereikbare
sidecar vertelt de app dat het wissen daar niet kon worden bevestigd.

Tokens staan versleuteld in `${DATA_DIR:-./data}/ah/appie.sqlite`; de webapp bewaart alleen een versleutelde
sidecarreferentie. Maak een back-up van die map terwijl de sidecar gestopt is, samen met de Postgres-data
en beide geheimen (`AH_SIDECAR_SECRET` en `BETTER_AUTH_SECRET`). Na wijziging of verlies van een geheim
moet je opnieuw koppelen. Op Linux moet de datamap schrijfbaar zijn voor de ingestelde `AH_UID:AH_GID`
(standaard `1000:1000`); op Unraid kun je bijvoorbeeld je eigen appdata-gebruiker instellen. Draai één
sidecarworker per datamap; de meegeleverde Docker-runtime doet dat al.

De exporthistorie toont de voortgang per lijst. Dezelfde verzoeksleutel gebruikt dezelfde duurzame job.
Exact aanwezige tekstregels worden overgeslagen; er worden geen hoeveelheden op een bestaande AH-regel
geraden of overschreven. Bij een deelresultaat, netwerkfout of herstart wordt niets automatisch opnieuw
geschreven. ‘Extern resultaat controleren’ leest de AH-lijst om onzekere regels te herkennen. Controleer
de lijst voordat je bewust een nieuwe export maakt. De app blijft eerdere bronclaims bewaken.
Bij fouten toont de historie de mislukte fase en waar beschikbaar de HTTP-status, zonder ruwe
AH-antwoorden of aanmeldgegevens. De tekstregeladapter corrigeert het payload van python-appie 0.2.2
naar het formaat van de oorspronkelijke appie-go-client (PRD en strikeThrough=false).

Verificatie gebruikt de echte vastgepinde AH-client met gecontroleerde HTTPX-antwoorden, tijdelijke
SQLite-opslag en een echte ASGI-service. De mobiele browsertests verbinden en exporteren via die
testservice. Docker-build en health worden afzonderlijk gecontroleerd. Dit bewijst geen live AH-aanmelding;
daarvoor moet een eigenaar een eigen account koppelen. Er zijn geen testboodschappen naar een live AH-account
gestuurd.

## Configuratie

Alle instellingen komen uit omgevingsvariabelen; zie [`.env.example`](.env.example) voor uitleg per variabele.

| Variabele                             | Verplicht | Doel                                                      |
| ------------------------------------- | --------- | --------------------------------------------------------- |
| `DATABASE_URL`                        | ja        | Postgres-verbinding (in compose automatisch gezet)        |
| `PUBLIC_BASE_URL`                     | ja        | Publieke URL; basis voor links en de MCP-resource         |
| `BETTER_AUTH_SECRET`                  | ja        | Geheim voor sessies en tokens (min. 32 tekens)            |
| `ADMIN_EMAIL`                         | ja        | E-mailadres van de platformbeheerder voor de eerste setup |
| `PORT`                                | nee       | Poort van de app (standaard 3000)                         |
| `AH_SIDECAR_URL`, `AH_SIDECAR_SECRET` | als paar  | Optionele AH-service; geheim minstens 32 tekens           |
| `AH_SIDECAR_PORT`, `AH_UID`, `AH_GID` | nee       | AH-compose: hostpoort (3001), gebruiker en groep (1000)   |
| `POSTGRES_PASSWORD`                   | nee       | Wachtwoord van de Postgres-gebruiker in compose           |
| `APP_PORT`, `DB_PORT`, `DATA_DIR`     | nee       | Alleen compose: poorten op de host en de datamap          |

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

Begin met `get_agent_guide` voor de volledige werkwijzer en `whoami` voor de actuele context.
`list_households` toont alleen je eigen lidmaatschappen met rollen. Met `switch_household({householdId})`
kies je bewust een ander eigen huishouden; die keuze geldt ook voor je webapp en andere verbonden agents.
Vernieuw een geopende webpagina om de wijziging te zien. Iedere volgende tool bepaalt de context opnieuw.
Een vreemde of inmiddels ingetrokken huishoud-ID geeft geen toegang. Controleer daarom vóór een reeks
wijzigingen welk huishouden actief is.

De werkwijzer en de beschrijvingen van de 44 tools leggen ook zoeken/hergebruik van IDs, onbekende
eenheden, versieconflicten en expliciete bevestiging van koken en export uit. Vraag `get_instruction_format`
voor de precieze beperkte OpenUI-syntax. Tokens en providergeheimen beheer je in de webapp; agenttools geven
ze nooit terug.

Start daarna Claude Code en kies bij `/mcp` de server _gerechter_ om in te loggen. Je browser opent de
inlogpagina en daarna een toestemmingsscherm; na _Toestaan_ kan de agent de tool `whoami` gebruiken. Verbonden
apps zie en trek je in onder Meer › Verbonden apps.

Je kunt de OAuth-flow ook rechtstreeks starten met `claude mcp login gerechter`. Zonder lokale browser
gebruik je `claude mcp login gerechter --no-browser`: open de getoonde URL op een apparaat met een browser,
log in op Gerechter, geef toestemming en plak de volledige callback-URL terug in de terminal als de browser
de lokale callback niet kan bereiken.

Vraag na het koppelen in Claude Code: _Roep de Gerechter-tool `whoami` aan._ Controleer dat `user` jouw naam
en e-mailadres bevat, `activeHousehold` het actieve huishouden met jouw rol toont en `households` uitsluitend
jouw huishoudens bevat. Trek daarna desgewenst de testkoppeling in via Meer › Verbonden apps.

Bij `Credit balance is too low` heeft Claude Code geen API-tegoed voor de modelaanroep. Dat kan optreden
nadat OAuth al geslaagd is: een ingestelde `ANTHROPIC_API_KEY` kan voorrang krijgen op een bestaande
Claude-aanmelding. Controleer `claude auth status` en de gewenste aanmelding voordat je opnieuw test.

Praktijkcontrole op 5 november 2026 met Claude Code 2.1.301: OAuth via `--no-browser` en een echte
`mcp__gerechter__whoami`-aanroep op `http://localhost:3000/mcp` geslaagd met fictieve testaccounts.
Zie [de verificatie van foundation](openspec/changes/foundation/verification.md) voor de overige controles.

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

`pnpm dev`, `pnpm start` en `pnpm db:migrate` lezen een aanwezige lokale `.env`; expliciet ingestelde
omgevingsvariabelen blijven leidend. De devserver luistert ook op `http://main-pc:3000`. Laat voor lokale
MCP-koppelingen `PUBLIC_BASE_URL=http://localhost:3000` staan; de lokale HTTP-aanmeldflow gebruikt die
resource-URL. Herstart de devserver na wijziging van de serverconfiguratie.

| Commando                       | Wat                                                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` | ESLint + Prettier, TypeScript                                                                                                                  |
| `pnpm test`                    | Unit- en integratietests (Vitest, Postgres via Testcontainers; Docker nodig)                                                                   |
| `pnpm test:e2e`                | Playwright op 360 px tegen een productiebuild, lege database `gerechter_e2e` en gecontroleerde AH-sidecar (Docker en uv met Python 3.13 nodig) |
| `pnpm db:generate`             | Nieuwe migratie uit het Drizzle-schema                                                                                                         |

Met `E2E_BASE_URL`, `E2E_DATABASE_URL` en `E2E_ADMIN_EMAIL` draait de e2e-suite tegen een al draaiende omgeving,
bijvoorbeeld een verse compose-stack.

Installeer voor de sidecarchecks [uv](https://docs.astral.sh/uv/getting-started/installation/) en gebruik:

```bash
uv sync --project sidecar --python 3.13 --frozen
uv run --project sidecar ruff check sidecar
uv run --project sidecar ruff format --check sidecar
uv run --project sidecar pytest sidecar/tests -q
```

De standaard Playwright-run start de geïsoleerde ASGI-testservice zelf. In de externe `E2E_BASE_URL`-modus
worden de drie AH-testscenario's overgeslagen, zodat die suite geen live AH-aanmelding probeert.

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
