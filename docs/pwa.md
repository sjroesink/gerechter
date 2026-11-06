# Installeerbare Gerechter (PWA)

Open Gerechter via HTTPS. Onder **Gerechter als app** verschijnt de installatieknop zodra de browser
installatie aanbiedt. Op iPhone/iPad staan daar instructies voor Safari › Deel › Zet op beginscherm.
Een geïnstalleerd/zelfstandig geopend exemplaar verbergt het aanbod. De interface ondersteunt native
`beforeinstallprompt` en `appinstalled`; een browser zonder installatieondersteuning krijgt geen dode knop.

## Online app, openbare offline melding

Dit is een geauthenticeerde TanStack React Start SSR-app, geen offline receptenarchief. De serviceworker
registreert uitsluitend in een productiebuild, op `/sw.js` met scope `/`. Een netwerkfout bij een gewone
appnavigatie toont een zelfstandige Nederlandse offline pagina. Geen login, recept, API-resultaat of
JavaScript-appshell wordt daarvoor bewaard. Ook een HTTP-fout (bijvoorbeeld 401/500) blijft het echte
serverantwoord; alleen een mislukte netwerkverbinding geeft de offline melding.

De gesloten cache-allowlist bestaat uit exact vijf publieke bestanden:

- `/pwa/offline.html`
- `/pwa/icon-192.png`
- `/pwa/icon-512.png`
- `/pwa/maskable-512.png`
- `/pwa/apple-touch-icon.png`

Installatie haalt deze bestanden zonder cookies/credentials op, zonder redirects en met SHA-256
Subresource Integrity. De worker schrijft nooit op basis van een gebruikersrequest in de cache.
Appdocumenten, appchunks, foto's onder `/afbeeldingen`, serverfuncties, API/MCP, auth/OAuth/discovery,
herstel-/uitnodigingslinks, AH-codeformulieren/callbacks en alle URL's met een query blijven buiten de cache.
Er is geen background sync, schrijfbuffer of offline opslaan. De offline melding zegt dit expliciet.

Alleen documentnavigaties naar `/`, `/meer` en `/week`, `/gerechten`, `/voorraad` (inclusief subpaden) mogen
bij een netwerkfout de openbare melding krijgen. Alle overige verzoeken blijven netwerk-only, waaronder
`/meer/account` en `/meer/boodschappen/verbindingen`. Niet-publieke same-origin verzoeken gebruiken
expliciet `fetch(..., { cache: 'no-store' })`, zodat ook een al opgewarmde HTTP-cache met immutable
privéfoto's geen offline data levert. De serverheaders en afbeeldingsopslag blijven ongewijzigd.
De worker verandert geen database-, auth- of AH-logica.

## Updates en hosting

`src/pwa/build.ts` berekent de cachenaam uit **workerbron plus alle publieke assethashes**. Een onvolledige
of gemengde update faalt vóór activatie en raakt de actieve cache niet. Activatie bewaart hoogstens de
huidige en één vorige publieke cache en verwijdert uitsluitend de eigen `gerechter-public-offline-v1-`
namespace. Er worden geen app-HTML/chunks tussen releases gecombineerd.

Een nieuwe worker wacht. **Bijwerken…** opent een native toegankelijk dialoog met waarschuwing over
niet-opgeslagen wijzigingen. Alleen **Nu bijwerken** verstuurt de activatieboodschap. De instemmende tab
herlaadt eenmaal; andere tabs verliezen geen invoer en sluiten hun oude updatemelding. Wanneer alle oude
tabs gesloten zijn, mag de browser de wachtende worker zelf activeren volgens de normale workerlevenscyclus.

Nitro 3 bundelt `/sw.js` als virtual handler in de productiebackend (geen Vite-dev-headertruc):

- `Content-Type: text/javascript; charset=utf-8`
- `Cache-Control: no-cache, no-store`
- `Cloudflare-CDN-Cache-Control: no-store`
- `Service-Worker-Allowed: /`

Het manifest heeft `application/manifest+json` en `Cache-Control: no-cache`. Controleer bij publicatie ook
de werkelijke HTTPS/CDN-respons; een lokale backendtest bewijst geen edge-instellingen. Het rootmanifest
heeft stabiele `id`, `scope` en `start_url` `/`; gebruikersgegevens/tokens horen niet in deze velden.

## Iconen en verificatie

De merkpot komt uit de bestaande PotIcon, wit op tomaatrood `#c23b22`. De meegeleverde PNGs zijn echt
192/512/maskable-512/Apple-180, ondoorzichtig, met het beeldmerk binnen de maskable veilige cirkel.
`src/pwa/icon.svg` is de bron; reproduceer met de bestaande Playwright-ontwikkelafhankelijkheid:

```sh
pnpm exec playwright install chromium
node scripts/generate-pwa-icons.mjs
# Optioneel: PWA_CHROMIUM_PATH=/pad/naar/chromium node scripts/generate-pwa-icons.mjs
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

De gewone CI-browserstap neemt `e2e/13-pwa.spec.ts` en `14-pwa-update.spec.ts` automatisch mee tegen de
productiebuild en wegwerpdatabase. De tests bewijzen native offline navigatie + refresh, strikte
netwerk-only gevoelige paden, cache-inspectie met een echte fixturesessie, iOS/native UI-lifecycle,
updateconsent in twee tabs, falende assetupdates en nul Chromium-installability-errors in een schoon
persistent profiel. De updatefixture is een lokale echte HTTP-releaseproxy: HTML/assets komen van de
gebouwde backend, alleen de aangeboden workerrevisie of een defect publiek bestand wisselt.

UI-events voor installatie en iOS-standalone zijn expliciet fixtures. Dit is geen fysieke OS-installatie
of echte Safari-test. De persistent Chromium-check vervangt die fixtures niet; hij toetst het echte
productiemanifest en browserinstallatiecriteria zonder incognitobeperking. Gebruik nooit een productiedatabase
voor de tests; bestaande E2E-voorbereiding weigert elke databasenaam behalve `gerechter_e2e`.

Primaire referenties: Nitro 3 routing/virtual handlers en route rules (`nitro.build`), TanStack Start
server/client rendering (`tanstack.com/start`), de MDN-documentatie over ServiceWorker, CacheStorage,
Web App Manifest, BeforeInstallPromptEvent en Subresource Integrity (`developer.mozilla.org`).
