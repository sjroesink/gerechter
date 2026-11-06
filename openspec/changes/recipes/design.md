# Design

## Context

Zie proposal.md. `catalog` levert zichtbare ingrediënt-ID's en omrekeningen. De bestaande gerechtenroute is nog een lege staat. De officiële OpenUI-pakketten 1.1.0 bieden een frameworkonafhankelijke parser en een React-renderer voor een eigen componentbibliotheek; de pakkettypes en eerste-partijdocumentatie zijn gecontroleerd.

## Goals / Non-Goals

**Goals:** één receptmodel voor UI en MCP, atomaire updates, stabiele verwijzingen, correcte porties en beperkte OpenUI-componenten met opslagvalidatie.

**Non-Goals:** weekplanning, voorraadmutaties, beoordelingen en boodschappen; die volgen in eigen changes. Er is geen ingebouwde modelaanroep of externe OpenUI-gateway nodig: agents leveren inhoud aan via MCP.

## Decisions

1. `recipe` bevat huishoud-ID, metadata, tags, instructies als begrensde JSON-secties, archiveringsdatum, versienummer en tijdstempels. `recipe_ingredient` bevat huishoud-ID, recept-ID, ingrediënt-ID, hoeveelheid (NULL betekent naar smaak/onbekend), eenheid, notitie en positie. Er zijn echte foreign keys; aanmaken en vervangen gebeurt in een transactie.
2. De domeinlaag valideert metadata, URL-protocollen, alle ingrediënt-ID's en alle instructies vóór schrijven. Ingrediënten worden in een batch binnen globaal-of-eigen zichtbaarheid geladen. Gearchiveerde ingrediënten mogen alleen behouden blijven als ze al in het bewerkte recept stonden. Basiseenheden worden niet gekopieerd of opnieuw geïnterpreteerd.
3. Updates vereisen het teruggelezen versienummer. Een conditionele update vergrendelt de actuele receptversie voordat de regels worden vervangen; een verouderde versie geeft Conflict. Archiveren behoudt de gegevens. Lezen schaalt hoeveelheden in het resultaat en muteert het opgeslagen recept niet.
4. Instructies gebruiken `preparation`, `cooking`, `serving`, `notes`, met tekst en optionele OpenUI-bron. De ingrediëntensectie komt uitsluitend uit de echte regels. De OpenUI-bibliotheek bevat `RecipeSteps`, `Step`, `Tip`, `Timer` en `Checklist`; tekst wordt door React geëscapet.
5. Een gedeelde frameworkonafhankelijke bibliotheek definieert de componentnamen en Zod-eigenschappen. De officiële parser valideert het hele programma. Daarna worden onvolledigheid, fouten, onopgeloste/ongebruikte verwijzingen, dynamische eigenschappen, staat-, query- en mutatiedeclaraties en onbekende componenten afgekeurd. De React-renderer gebruikt dezelfde eigenschappen en krijgt geen toolprovider. Alleen Timer en Checklist hebben lokale interactie.
6. Routes: gerechtenindex, nieuw, detail en bewerken. Nieuwe routes worden als siblings ingericht, zodat een detailpagina de editor niet per ongeluk als verborgen kind rendert. De bestaande mobiele schil en thematokens blijven leidend.
7. MCP krijgt `search_recipes`, `get_recipe`, `create_recipe`, `update_recipe`, `set_recipe_archived` en `get_instruction_format`. De tools gebruiken altijd de actuele tokencontext; geen schrijfparameter kan een ander huishouden selecteren.

## Risks / Trade-offs

- [Verkeerde gegenereerde OpenUI] → officiële parser, strikte allowlist, begrensde tekst/structuur en domeinfouten vóór opslag.
- [Onbedoelde overschrijving door UI en agent] → expliciet versienummer en atomaire wijziging.
- [Onbekende hoeveelheden] → nullable basishoeveelheden blijven zichtbaar onbekend voor latere voorraad- en boodschappenberekeningen.
- [Ontwikkelhulpmiddelen van een dependency verschijnen in de productinterface] → de auto-mount van de vastgepinde OpenUI-devtools wordt uitgeschakeld vóór het lui laden van de renderer; productiebundels bevatten die auto-mount niet.

## Migration Plan

Genereer en verifieer een additieve migratie tegen Testcontainers. Pas die lokaal toe vóór gebruik van de nieuwe UI/tools. Bestaande accounts, catalogus en OAuth-toestemming blijven intact. Terugrollen kan de nieuwe tabellen laten staan zonder oude tabellen te wijzigen.
