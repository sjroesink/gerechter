# Design

## Context

Zie proposal.md. Recepten hebben huishoudafscherming, versies, archivering en lineaire hoeveelheden. Huishoudvoorkeuren leveren standaardporties. De Week-route is nog een lege staat; cooking-history en shopping gebruiken de planning later.

## Goals / Non-Goals

**Goals:** één kalenderdagmodel voor UI, MCP en volgende modules, versiegestuurde samenwerking en consistente hoeveelheden.

**Non-Goals:** terugkerende planningen, automatische suggesties, voedingswaarden, een aparte ontbijt/lunch/diner-indeling of automatische voorraadmutaties.

## Decisions

1. `planned_meal` bevat huishoud-ID, SQL-date als YYYY-MM-DD-string, kind recipe/free, recept-ID of vrije titel, optionele porties, notitie, versie, deletedAt en tijdstempels. Checks bewaken de vorm van beide soorten. Meerdere items per dag zijn toegestaan en worden op aanmaak/id geordend.
2. Kalenderhulpfuncties valideren echte ISO-kalenderdagen, rekenen op UTC-middag en leveren weekstart en zeven datums. Alleen ‘vandaag’ gebruikt Europe/Amsterdam. Dit vermijdt verschuiving door serverzone en zomertijd zonder een datumdependency toe te voegen.
3. Nieuwe receptverwijzingen moeten zichtbaar en actief zijn. Bij wijzigen mag een bestaande gearchiveerde verwijzing behouden blijven. Lezen voegt huidige receptnaam en archiefstatus toe; detail haalt met de effectieve porties de bestaande receptdomeinfunctie aan. Vrije items hebben geen ingrediënten. De portie-overschrijving is nullable; null gebruikt de huidige huishoudvoorkeur.
4. Wijzigingen zijn conditioneel op huishouden/id/versie/deletedAt. Verwijderen is soft-delete en verhoogt de versie, zodat latere MadeEvents naar het item kunnen blijven verwijzen. Een al verwijderd item wordt bij gewoon lezen als niet gevonden behandeld.
5. Routes worden siblings: weekindex, dagdetail, nieuw item, itemdetail en bewerken. Een gedeelde editor ondersteunt kiezen van gerecht of vrije tekst en datum, porties en notitie. Weeknavigatie gebruikt expliciete links; direct geopende details hebben een vaste teruglink.
6. MCP krijgt get_week_plan, get_day_plan, get_planned_meal, create_planned_meal, update_planned_meal en remove_planned_meal. De huidige tokencontext bepaalt het huishouden. Recept- en planningversies hebben elk hun eigen betekenis.

## Risks / Trade-offs

- [Ongeldige datums worden genormaliseerd] → vergelijken met de originele ISO-dag vóór opslag en testen op schrikkeljaren/jaargrenzen.
- [Nieuwe huishoudvoorkeur verandert ongespecificeerde porties] → toon ‘huishoudstandaard’ expliciet; een maaltijd kan een vaste overschrijving krijgen.
- [Archivering maakt planning onleesbaar] → alleen nieuwe verwijzingen weigeren; bestaande leesbaar houden.
- [Gelijktijdig plannen overschrijft wijzigingen] → verwachte versie bij wijzigen/verwijderen, met conflict en behoud van eerdere inhoud.

## Migration Plan

Genereer en test de additieve tabel met foreign keys, checks en huishoud/datum-index. Pas lokaal toe met behoud van accounts, recepten en voorraad. Bij rollback kan de ongebruikte tabel blijven bestaan.
