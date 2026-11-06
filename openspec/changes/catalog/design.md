# Design

## Context

Zie proposal.md. De bestaande applicatie gebruikt Drizzle/Postgres met `pg_trgm`, verplichte `Ctx`-objecten, dunne server functions en een stateless MCP-handler. De catalogus ontbreekt volledig. Er zijn nog geen bestaande hoeveelheden die gemigreerd moeten worden.

## Goals / Non-Goals

**Goals:** dezelfde validatie, zoekresultaten en rechten in UI en MCP; stabiele ingrediënt-ID's en basiseenheden voor volgende modules; directe huishoudafscherming.

**Non-Goals:** voorraadmutaties, receptopslag, een externe supermarktproductcatalogus en het raden van gewichten of dichtheden.

## Decisions

1. `ingredient` bewaart `household_id` (NULL voor globaal), naam, genormaliseerde naam, aliassen als tekstarray, basiseenheid, archiveringsdatum en tijdstempels. Twee partiële unieke indexen bewaken de naam per globale of huishoudcatalogus. Een trigramindex ondersteunt zoeken op naam; aliassen worden eveneens in de overeenkomstscore meegenomen. Een losse aliastabel is hier onnodig: aliassen hebben dezelfde zichtbaarheid en levenscyclus als hun ingrediënt.
2. Alle catalogusqueries gebruiken globaal-of-eigen zichtbaarheid, ook voor platformbeheerders. Schrijfrechten worden in de domeinlaag gecontroleerd: globaal vereist admin; eigen vereist het actieve huishouden. Zod valideert daar eveneens de invoer, zodat geen adapter de regels kan overslaan.
3. Basiseenheden zijn `g`, `ml` en `stuk`. Eenheden zijn vaste data met dimensie en, voor massa/volume, factor naar g/ml. Aantaleenheden zoals blik, pak, teen, bos en plak delen geen universele omrekenfactor.
4. `ingredient_conversion` koppelt een ingrediënt en broneenheid aan een positieve factor naar de basiseenheid. De factor geldt via een vaste verhouding ook voor compatibele massa- of volumeeenheden. Vage eenheden worden vóór het opzoeken van factoren afgewezen als niet-exact. Een ontbrekende omrekening is `null`, nooit impliciet nul of één.
5. Archiveren vervangt verwijderen. De basiseenheid verandert niet na aanmaak. Zo blijven latere verwijzingen en voorraadhoeveelheden geldig. Namen en aliassen zijn wel aanpasbaar.
6. De UI heeft een cataloguslijst met zoekveld, een formulier voor nieuw/wijzigen en een detail met omrekeningen. De routes hangen onder Meer; Beheer verwijst naar hetzelfde globale beheer. De bestaande thematokens en minimaal 44px hoge velden/knoppen worden hergebruikt.
7. MCP biedt `list_units`, `search_ingredients`, `get_ingredient`, `create_ingredient`, `update_ingredient`, `set_ingredient_archived`, `set_ingredient_conversion` en `remove_ingredient_conversion`. Tools krijgen geen huishoud-ID als schrijfparameter: die komt altijd uit het token. Toolbeschrijvingen schrijven zoeken en hergebruik vóór aanmaken voor.

## Risks / Trade-offs

- [Verkeerde handmatige factor beïnvloedt toekomstige hoeveelheden] → alleen bevoegde beheerders, positieve begrensde waarden, exacte weergave en intrekken mogelijk.
- [Dubbele gelijktijdige aanmaak] → unieke database-indexen en vertaling naar een domeinconflict.
- [Benaderend zoeken verwart verschillende ingrediënten] → exacte treffers eerst, expliciete keuze van het ingrediënt-ID, nooit stil samenvoegen.

## Migration Plan

Genereer een additieve Drizzle-migratie en test die tegen Testcontainers. Voer deze ook via `pnpm db:migrate` uit op de lokale database voordat de nieuwe routes/MCP-tools worden gebruikt. Bestaande accounts en huishoudens blijven behouden. Een terugrol van de applicatiecode kan de nieuwe tabellen laten staan zonder bestaand gedrag te breken.
