# Design

## Context

Zie proposal.md. De catalogus kent vaste basiseenheden en expliciete omrekeningen. Recepten leveren exacte basishoeveelheden of null bij ontbrekende informatie. Voorraad is nog een lege pagina. UI en MCP bouwen dezelfde actuele Ctx.

## Goals / Non-Goals

**Goals:** voorraad als herleidbare huishoudoverlay, consistente correcties bij gelijktijdig gebruik en een gedeelde standaard voor porties.

**Non-Goals:** automatische afboeking, planning en boodschappenberekening; volgende changes gebruiken deze bron. Geen houdbaarheidsdatums, afzonderlijke partijen of locaties.

## Decisions

1. Een `pantry_item` per huishouden/ingrediënt bewaart `quantity` in de basiseenheid, `staple`, versie en tijd. Een unieke sleutel voorkomt dubbele regels. Nul met staple=false blijft intern bestaan voor versiecontrole, maar verdwijnt uit de actieve lijst. Dit behoudt historie zonder een deleted-ID of aparte archieftabel.
2. Basisvoorraad betekent expliciet ‘altijd in huis’; er wordt geen oneindige numerieke voorraad opgeslagen. De exacte hoeveelheid blijft onafhankelijk beschikbaar. Latere boodschappenberekening kan een basisvoorraadingrediënt uitsluiten, terwijl koken alleen een bevestigde exacte hoeveelheid afboekt.
3. De invoer accepteert een hoeveelheid en een bekende eenheid. De gedeelde omrekenfunctie converteert naar de basiseenheid; null betekent een fout bij een exacte telling. De UI toont de basiseenheid en laat bestaande, ook gearchiveerde ingrediënten corrigeren. Nieuwe regels vereisen een actief zichtbaar ingrediënt.
4. Schrijven vereist een teruggelezen versie; een ontbrekende regel heeft versie 0. Een conditionele upsert binnen een transactie verandert de hoeveelheid en schrijft één `pantry_movement` met actor, telling/correctie, notitie en voor/na. Conflicten rollen alles terug. Verwijderen is een versiegestuurde telling naar nul en staple=false. Historie blijft op huishouden en ingrediënt gescopeerd.
5. Een `household_preferences`-rij met huishouden als sleutel bewaart standaardporties. Afwezig betekent 2. Alle leden mogen de gedeelde voorkeur wijzigen. De receptdetailadapter kiest die standaard bij afwezigheid van expliciete porties; de domeinfunctie getRecipe en de editor behouden de oorspronkelijke receptporties.
6. De voorraadlijst biedt zoeken, een aparte toevoegrouting en detail voor telling, basisvoorraad, verwijderen en historie. Standaardporties komen op de huishoudpagina. MCP krijgt get_pantry, get_pantry_item, set_pantry_item, remove_pantry_item, get_pantry_history, get_household_preferences en set_household_preferences.

## Risks / Trade-offs

- [Gelijktijdige telling overschrijft werk] → conditionele versiecontrole en atomaire mutatiehistorie.
- [Vage eenheid wordt ten onrechte exact] → dezelfde expliciete omrekening als recepten, met weigering bij null.
- [Basisvoorraad lijkt een gemeten hoeveelheid] → apart veld met uitleg en onafhankelijke numerieke voorraad.
- [Verwijderen wist auditgegevens] → nulregel behouden en historie zonder cascade naar de voorraadregel.

## Migration Plan

Additieve tabellen met foreign keys en checks; genereer en test migratie tegen Postgres, pas vervolgens lokaal toe. Geen bestaande tabellen of accounts worden verwijderd. Bij rollback mogen de ongebruikte tabellen blijven staan.
