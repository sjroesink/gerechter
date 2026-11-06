# Design

## Context

Zie proposal.md. Planning en recepten zijn versiegestuurd. Voorraad is een telling per huishouden/ingrediënt met versie en mutatiehistorie. Omrekeningen leveren null bij onduidelijkheid. De gemaakt-flow moet deze bronnen atomair verbinden.

## Goals / Non-Goals

**Goals:** bewuste registratie, aanpasbare exacte afboeking, herhaalveiligheid en persoonlijke beoordelingen zonder historische inhoud te veranderen.

**Non-Goals:** automatische registratie uit planning, achteraf stil herschrijven van voorraadmutaties, foto-uploads of voedingswaarden. Een verkeerde voorraadtelling kan via de bestaande expliciete correctieflow worden hersteld.

## Decisions

1. `made_event` bevat huishouden, recept en optionele planningreferentie, actor-ID/naam, datum, porties, requestId, invoerhash en een JSON-momentopname van receptnaam, oorspronkelijke porties, geschaalde ingrediënten en instructies. Een unieke huishouden/requestId-sleutel voorkomt dubbele verwerking. `made_deduction` verbindt een ingrediënt en bevestigde hoeveelheid met de voorraadmutatie. `made_rating` is uniek per event/gebruiker en bevat naam, optioneel cijfer en notitie.
2. Voorbereiden leest actuele recept/planningversies, porties en voorraad. Gelijke ingrediënt-ID's worden samengevoegd. Bij enige onbekende basishoeveelheid wordt geen automatisch totaal geraden: benodigde hoeveelheid null en voorstel nul. Anders is het voorstel min(behoefte, exacte voorraad). Basisvoorraad geeft geen extra numerieke voorraad. Elke hoeveelheid blijft handmatig instelbaar in de basiseenheid.
3. Bevestigen ontvangt een servergegenereerde requestId, bronversies en de expliciete afboeklijst met verwachte voorraadversies. De domeinlaag valideert dat alle ingrediënten in het recept voorkomen, geen ID dubbel staat en hoeveelheden eindig/niet-negatief zijn. Een hoeveelheid boven de actuele voorraad wordt geweigerd. Nulregels muteren niets.
4. Binnen één transactie worden recept en eventuele planning gecontroleerd/vergrendeld, de momentopname opgebouwd en het event uniek ingevoegd. Bij een bestaande sleutel worden actor en hash gecontroleerd en wordt dezelfde ID teruggegeven. Positieve afboekingen worden in vaste ingrediëntvolgorde conditioneel op voorraadversie en voldoende voorraad uitgevoerd, met een auditmutatie en eventverwijzing. Fouten rollen event, mutaties en initiële beoordeling terug. Gedeelde Ctx ondersteunt Db of Tx zodat bestaande regels ook binnen de transactie worden gebruikt.
5. Een beoordeling gebruikt altijd ctx.user.id, nooit een schrijfbare userId. Een lege beoordeling wist de eigen rij; andere leden blijven onaangetast. Alle reads scopen op event én huishouden. Beoordelen verandert geen voorraad. De receptmomentopname blijft onafhankelijk van latere wijzigingen leesbaar.
6. UI: gemaakt-pagina bij het recept, met optionele planningreferentie en porties; expliciet bevestigingsformulier met cijfer/notitie en afboekregels. Geschiedenis onder Meer met zoeken, detail, eigen beoordeling en de momentopname. Links komen op recept en geplande maaltijd. MCP krijgt prepare_cooking, record_made, search_cooking_history, get_made_event en set_my_made_rating; mutatietools beschrijven de vereiste bewuste bevestiging.

## Risks / Trade-offs

- [Dubbele klik boekt dubbel af] → unieke verzoeksleutel, invoerhash en dezelfde teruggegeven event-ID.
- [Slechts enkele ingrediënten worden afgeboekt] → één transactie met versiecontrole en rollback bij ieder conflict.
- [Vage hoeveelheden worden exact gemaakt] → nulvoorstel met uitleg; alleen bewuste handmatige basishoeveelheid kan positief zijn.
- [Historie volgt later gewijzigde recepten] → momentopname bij registratie, met behoud van echte referenties.
- [Deadlocks bij dezelfde ingrediënten] → vaste lock-/schrijfvolgorde en gerichte concurrentietests.

## Migration Plan

Voeg tabellen additief toe, verifieer checks/foreign keys en atomiciteit tegen Postgres, migreer vervolgens lokaal. Bestaande accounts, voorraad en recepten blijven behouden. Bij rollback mogen de nieuwe tabellen blijven staan.
