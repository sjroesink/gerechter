# Design

## Context

Zie proposal.md. Recepten leveren geschaalde hoeveelheden en bekende basishoeveelheden; planning levert dag/weekitems, voorraad een exacte telling en aparte basisvoorraadkeuze. MadeEvents verwijzen eventueel naar planning. De officiële Notion-documentatie is gecontroleerd: API 2026-03-11, page-parent met title, to_do-blokken, gepagineerde child reads en beperkte requestgrootte. Een schrijffout kan na een geslaagde commit optreden.

## Goals / Non-Goals

**Goals:** één onafhankelijke behoefteberekening, herleidbare bewuste export en veilige herhaling, ook bij overlappende selecties.

**Non-Goals:** automatisch bestellen, een kassamandje, automatische productkeuze of tweewegsynchronisatie met een veranderde Notion-checklist. AH wordt in de volgende change als provider aangesloten. Een live Notion-controle kan pas met een door de gebruiker ingestelde verbinding; contracttests gebruiken echte request-/responsevormen zonder een live resultaat te claimen.

## Decisions

1. Bronkeuze is recipe (recipeId, porties), day (datum) of week (datum). Dag/week laden actieve planning en slaan vrije items en items met een MadeEvent over, met reden. Gearchiveerde recepten in bestaande planning blijven bruikbaar. Alle bekende basishoeveelheden worden per ingrediënt opgeteld; voorraad wordt één keer afgetrokken. Onbekende regels blijven als originele hoeveelheid/eenheid plus uitleg staan, ook naast een exact bekend deel. Basisvoorraad staat in een aparte uitgesloten lijst.
2. Een voorstel bevat bronkeys, samenvatting, lijstregels, uitsluitingen, leesbare tekst, requestId en een canonieke inhoudsfingerprint van relevante bronversies, porties, voorraadversies en inhoud. Export berekent binnen een transactie opnieuw en weigert een gewijzigd voorstel. Een receptbron heeft key recipe:id; een geplande bron planned:id, zodat dag en week dezelfde bronclaim delen.
3. `shopping_connection` bewaart een Notion-ouderpagina en een AES-256-GCM-versleuteld token. De sleutel wordt met een domeinscheiding uit BETTER_AUTH_SECRET afgeleid; de huishoud-ID wordt als authenticated data gebruikt. Alleen eigenaren schrijven verbindingen. Reads bevatten uitsluitend doel, ingestelde status en ouderpagina. Alleen de server/provider ontsleutelt het token. Een ander Notion-doel krijgt een andere targetKey zodat de oude doelhistorie behouden blijft.
4. `sync_run` bewaart huishouden, requestId, actor, target/targetKey, bron, fingerprint, bronsleutels, lijst-/tekstsnapshot, status, eventuele externe ID/URL en een veilige foutmelding. `sync_source_claim` is uniek per huishouden/targetKey/sourceKey. Reserveren serialiseert per huishouden/doel in een transactie, bewaart de run en claimt bronnen. Dezelfde requestId met dezelfde inhoud levert dezelfde run; met andere inhoud een conflict. Overlap vereist allowRepeat=true. Bij een definitieve afwijzing of share-annulering worden uitsluitend claims van die run vrijgegeven; historie blijft.
5. Externe IO vindt na reservering plaats. Alleen de nieuwe reservering start de provider. Een herhaald verzoek start geen nieuwe schrijfactie. Pending/onzeker houdt claims vast. Voor share levert de provider tekst; de browser bevestigt copied/shared/cancelled. Bestaande tekst blijft vanuit historie leesbaar. Het native deelmenu wordt alleen gebruikt als het beschikbaar is; klembord heeft een fallback naar geselecteerde tekst.
6. ShoppingTarget levert send en optionele read-only statuscontrole. Notion maakt één childpagina met een runmarker in de titel en to_do-regels; groepen begrenzen arrays op 100. Totale blokken en payloadbytes worden vóór IO op officiële limieten gecontroleerd. Ongeldige of te grote exports krijgen een gerichte melding om de selectie te verkleinen. De provider gebruikt vaste api.notion.com-URLs, API-versie 2026-03-11 en begrensde time-outs. Definitieve 4xx-afwijzingen zijn failed; transport-, 5xx- of onbruikbare succesresultaten zijn uncertain. Een 503 met committed_resource_id kan veilig read-only worden gecontroleerd. Schrijfacties worden niet automatisch herhaald.
7. Notion-statuscontrole leest ouder-childpagina's gepagineerd en zoekt de unieke runmarker; een match levert id/url terug. Niet gevonden betekent ‘nog niet bevestigd’, geen automatische resend. Instellingen wijzigen doet een onzekere oude run niet alsnog onder een nieuwe verbinding verzenden. Share-resultaat bevestigen is gebonden aan de oorspronkelijke actor en de geldige status.
8. UI: boodschappenpagina onder Meer met bronkeuze/voorstel en links vanaf recept, dag en week; exportknoppen, expliciete herhaalkeuze en eerdere runlinks. Instellingen en runhistorie zijn aparte details. MCP biedt behoeftevoorstel, verbindingstatus, starten, share-resultaat bevestigen, runs lezen en externe status controleren. Tokens worden uitsluitend via het instellingenformulier geschreven, niet via agentleesacties.

## Risks / Trade-offs

- [Dubbele export door overlap] → bronclaims over dag/week heen, expliciete herhaalkeuze en bewaarde eerdere runs.
- [Voorraad wordt tussen voorstel en verzending geteld] → actuele inhoudsfingerprint controleren vóór reservering.
- [Notion verwerkt een aanvraag zonder antwoord] → uncertain, markercontrole via reads en geen automatische schrijfretry.
- [Token lekt via fouttekst] → eigen veilige meldingen, geen ruwe providerbody of credentialvelden in leesresultaten.
- [Notion overschrijdt payloadlimieten] → blok-/array-/bytevalidatie vóór de externe aanvraag.

## Migration Plan

Additieve tabellen, foreign keys, statuschecks en unieke verzoek-/bronclaims. Verifieer met Postgres en gemockte providercontracten, migreer lokaal en controleer UI/MCP met behoud van bestaande gegevens. Verbindingen zijn aanvankelijk leeg; niets wordt zonder ingestelde verbinding naar Notion gestuurd.

## Sources

- https://developers.notion.com/reference/post-page
- https://developers.notion.com/reference/block
- https://developers.notion.com/reference/get-block-children
- https://developers.notion.com/reference/request-limits
- https://developers.notion.com/reference/versioning
