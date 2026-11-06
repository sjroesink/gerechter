# Design

## Context

Zie proposal.md. ShoppingTarget en SyncRun ondersteunen al het AH-doeltype. python-appie 0.2.2 is op PyPI en in de bijbehorende tag onderzocht. De client accepteert een AHAuthClient; load_tokens/save_tokens kunnen worden overschreven. ListsAPI ondersteunt tekstregels met hoeveelheid 1 en get_list. De officiële clientaanmeld-URL eindigt in appie://login-exit.

## Goals / Non-Goals

**Goals:** een echte geïsoleerde client, geen globale credentials, herhaalveilige exports en duidelijke onzekere/partiële resultaten.

**Non-Goals:** productmatching, winkelmandjes, bestellen, afrekenen of automatische herhaling van onzekere writes. Geen live aanmelding zonder de gebruiker. De standaard app blijft zonder sidecar werken.

## Decisions

1. Python 3.13, FastAPI, uvicorn met één worker en python-appie==0.2.2; versies worden gelockt met uv. Een SQLite-bestand in de persistente datamap bevat verbindingen en jobs. Een optionele compose-override voegt de service toe; de hostpoort bindt alleen aan loopback voor lokale ontwikkeling.
2. De service vereist een constant-time gecontroleerd Bearer-servergeheim. Een verbinding krijgt een willekeurige ID en aparte 256-bit toegangssleutel, waarvan alleen de hash in SQLite staat. Node bewaart ID en versleutelde sleutel in shopping_connection. Sidecarrequests komen uitsluitend van de geconfigureerde server-URL, met de server- en verbindingssleutel. Fout- en validatieresponses zijn generiek en bevatten geen inputwaarden.
3. Een eigenaar opent de gecontroleerde AH-aanmeld-URL en plakt de code of callback-URL in het verbindingsformulier. De server wisselt die via de sidecar uit. Een AHAuthClient-subclass laadt/slaat StoredToken in SQLite op met AES-256-GCM, een van het sidecargeheim afgeleide sleutel en verbindings-ID als authenticated data. Er wordt geen standaardbestand in ~/.config/appie gebruikt. De echte refreshmethode bewaart vernieuwde tokens via dezelfde opslag.
4. POST exports reserveert uniek per verbinding/export-ID met invoerhash en retourneert snel een pending-job. Alleen een nieuwe reservering plant een achtergrondtaak. Jobs en regelstatussen staan duurzaam in SQLite. Eén asyncio-lock per verbinding voorkomt gelijktijdige tokenrefresh en lijstmutaties. Voor iedere nieuwe regel wordt inflight opgeslagen; daarna volgt de echte add_item-aanroep met de volledige omschrijving en quantity=1. Identieke regels binnen de invoer worden eerst samengevoegd als ‘2× omschrijving’, zodat multipliciteit behouden blijft zonder een eenheidsomrekening. Bekende aanwezige identieke omschrijvingen worden overgeslagen.
5. De taak leest de bestaande lijst vóór schrijven. Na een fout met een mogelijk uitgevoerde write wordt niet verder geschreven. Alleen een ondubbelzinnige afwijzing zonder eerdere toevoegingen wordt failed; andere onduidelijke/partiële resultaten blijven uncertain. Opstarten zet onderbroken pending/running-jobs op uncertain. Read-only controle vergelijkt nog onzekere regels met get_list; bevestigde eerdere regels blijven bevestigd. Niet aangetroffen regels maken alleen een bewuste nieuwe export na controle mogelijk, geen automatische hervatting.
6. Node heeft een AH ShoppingTarget-adapter voor starten en statuscontrole. Pending-jobs mogen direct worden gelezen; Notion behoudt de bestaande wachttijd voor een mogelijk nog lopende create. De runpagina ververst AH-voortgang met begrensde read-only controles. Alle resultaten lopen door bestaande SyncRuns en bronclaims; geen aparte stille exportroute.
7. Optionele AH_SIDECAR_URL en AH_SIDECAR_SECRET worden als paar gevalideerd. De app toont een instelbare AH-sectie alleen als de service is geconfigureerd, met experimentele aanduiding. Eigenaren verbinden/ontkoppelen; leden gebruiken de ingestelde verbinding. Loskoppelen verwijdert de appreferentie ook als de sidecar tijdelijk niet bereikbaar is, en probeert de sidecarreferentie en tokenopslag te wissen.
8. Tests gebruiken de vastgepinde echte AHClient/AHAuthClient met een gecontroleerd HTTPX-transport, SQLite in tijdelijke mappen en een echte ASGI-service. Geen productie-endpoint biedt een testmodus. Een apart testsysteem kan dependency-injectie gebruiken voor contracten zonder AH-netwerkverkeer.
9. Een lokale ListsAPI-subclass past uitsluitend het toevoegpayload voor tekstregels aan: PRD en strikeThrough=false, zoals de oorspronkelijke appie-go-client. python-appie 0.2.2 verstuurt TXT zonder strikeThrough. Authenticatie, HTTP-afhandeling, responsemapping en het ontbreken van retries blijven bij de vastgepinde client. Een strikte transporttest controleert het volledige payload, ook voor omschrijvingen met hoeveelheden en accenten. Dit bronverschil is een compatibiliteitscorrectie; zonder nieuwe live export is niet bewezen dat dit de eerdere weigering oplost.
10. Jobfouten bewaren alleen een vaste fase, HTTP-status en vaste toelichting of een vaste netwerk-/timeoutmelding. Ruwe exceptiontekst en AH-responsebody blijven intern en worden niet gelogd of opgeslagen. Diagnostiek verandert de failed/uncertain-grens niet. Een live verbinding wordt voor deze correctie alleen uitgelezen; oude mislukte jobs worden niet hervat.

## Risks / Trade-offs

- [Onofficiële AH-API verandert] → experimenteel label, vastgepinde client en veilige fouten; andere providers blijven beschikbaar.
- [Tokenrefresh gebruikt gedeeld bestand] → eigen authopslag per verbinding en encryptie met AAD.
- [Proces valt tijdens schrijven weg] → duurzame inflight-status en geen automatische hervatting; read-only herstel.
- [Zelfde lijstregel bestaat al] → exacte genormaliseerde omschrijving controleren, geen productinterpretatie of hoeveelheid raden.
- [Meerdere workers doorbreken de verbindingslock] → één worker in de geleverde runtime en expliciete configuratie/documentatie.

## Migration Plan

Geen nieuwe Postgres-tabellen nodig. Voeg optionele envvelden, de compose-override en een sidecar-datavolume toe. Start de sidecar lokaal en controleer health zonder AH-aanmelding. Bestaande appdata, accounts, recepten en providers blijven behouden. Terugrollen kan door de optionele service te stoppen; historie blijft in de app.

## Sources

- https://pypi.org/project/python-appie/0.2.2/
- https://github.com/tijnschouten/appie/tree/v0.2.2/src/appie
- https://github.com/tijnschouten/appie/blob/v0.2.2/docs/authentication.md
- https://github.com/gwillem/appie-go/blob/main/shoppinglist.go
- https://fastapi.tiangolo.com/advanced/events/
