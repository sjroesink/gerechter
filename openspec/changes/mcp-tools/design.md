# Design

## Context

Zie proposal.md. De bestaande stateless MCP-handler bouwt per aanvraag een server en resolveCtx leest de bewaarde gebruikersvoorkeur en actuele lidmaatschappen. Domeinfuncties listMyHouseholds en switchHousehold bestaan al voor de webapp. De inhoudelijke modules registreren samen met whoami veertig tools.

## Goals / Non-Goals

**Goals:** dezelfde domeinfuncties en context gebruiken; vindbare instructies zonder een tweede uitvoeringspad.

**Non-Goals:** accountbeheer of providergeheimen via agents, impliciete huishoudwissels en een huishoudparameter op iedere inhoudelijke write.

## Decisions

1. Voeg een kleine contextadapter toe die de bestaande domeinfuncties aanroept en na wisselen resolveCtx gebruikt voor het antwoord. Houd getCtx dynamisch bij elke tool; cache geen Ctx in een MCP-sessie. Een eigen agentlokale keuze zou afwijken van de vastgelegde architectuur en de webapp.
2. Geef de werkwijzer als gestructureerde data met versie, toolgroepen en regels. Gebruik dezelfde definitie voor serverinstructies en de leestool, zodat clients ook bij discovery bruikbare instructies krijgen. get_instruction_format blijft de bron voor exacte OpenUI-syntax en voorbeelden.
3. Test met echte OAuth-tokens en Postgres: meerdere lidmaatschappen, ongeldige keuze, oude privé-IDs, lidmaatschap intrekken en web-/MCP-context. De bestaande moduletests blijven de betekenis van inhoudelijke acties bewaken.

## Risks / Trade-offs

- [Webapp of andere agent wisselt tegelijk] → iedere tool leest opnieuw; de werkwijzer vraagt whoami vóór een reeks wijzigingen en opnieuw bij twijfel. Lopende acties houden de bij start gecontroleerde context.
- [Werkwijzer raakt achter op tools] → een test vergelijkt de volledige ontdekte toolset met de beschreven groepen.

## Migration Plan

Geen migratie. Herladen van de app publiceert drie extra tools. Bestaande OAuth-clients en inhoudelijke tools blijven geldig.
