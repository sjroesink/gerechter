# Design

## Context

Zie proposal.md. Ingrediënten hebben een globale of huishoudelijke herkomst; bestaande domeinfuncties controleren zichtbaarheid en beheer. Gerechten hebben al photoUrl. TheMealDB biedt een vrije persoonlijke/development API met ingrediëntenlijst en afbeeldingen; de voorwaarden zijn op 5 november 2026 gecontroleerd.

## Goals / Non-Goals

**Goals:** één foto-object per ingrediënt, bronvermelding, behoud bij oude clients en dezelfde catalogusrechten.

**Non-Goals:** volledige receptenimport, beeldgeneratie, willekeurig zoeken tijdens elke paginalading en product-/merkherkenning.

## Decisions

1. Voeg een nullable JSONB-kolom photo toe met url, sourceUrl, credit en licenseUrl. Valideer in de domeinlaag; URLs zijn HTTP(S), zonder gebruikersnaam/wachtwoord. Een object houdt de optionele herkomst bij elkaar. Afzonderlijke velden zouden dezelfde validatie over meer kolommen verspreiden.
2. create/update accepteren photo optioneel. Bij update betekent ontbrekend ‘behouden’, null ‘wissen’. Dat voorkomt dat bestaande MCP-clients foto's verliezen bij een gewone naamwijziging.
3. Lees de actuele catalogusfoto door naar voorraad en receptingrediënten. Presenteer decoratieve thumbnails naast de bestaande naam en een grotere foto met bronlinks op de ingrediëntpagina. Een lokale foutstatus toont een neutrale fallback; geen serverdownload of proxy voor willekeurige URLs.
4. Koppel voorbeeldbeelden eenmalig via de echte MCP-client, na lezen van de officiële TheMealDB-ingrediëntenlijst en controle van de afbeeldingen. Nederlandse namen blijven behouden; vertaling dient uitsluitend om de gecontroleerde bronfoto te kiezen. Bron/voorwaarden blijven opgeslagen en zichtbaar. Niet-passende afbeeldingen blijven leeg.
5. Voeg foto's bij boodschappen pas na berekening van tekst en inhoudsfingerprint toe aan de leesweergave. Hergebruik de foto's van de reeds afgeschermde receptregels; geen extra queries. Foto's zijn optioneel voor compatibiliteit met bestaande exportsnapshots en wijzigen de exportcontrole niet.

## Risks / Trade-offs

- [Externe foto verdwijnt] → visuele fallback; de eigenaar kan de URL wijzigen.
- [Gratis is niet onbeperkt publiek] → README onderscheidt persoonlijk gebruik van publieke uitrol en bewaart de bronvoorwaarden; geen open licentie claimen voor alle TheMealDB-beelden.
- [Thumbnails beïnvloeden toegankelijke namen] → decoratieve alt-tekst in lijsten, betekenisvolle detailafbeelding en bestaande tekstlabels behouden.

## Migration Plan

Genereer één additieve migratie. Bestaande rijen krijgen null. Test tegen echte Postgres, pas toe op de lokale database en lees beelden daarna via MCP en browser terug. Terugzetten van een beeld kan door photo:null; de nieuwe kolom hoeft daarvoor niet verwijderd te worden.

## Sources

- https://www.themealdb.com/docs_api_guide.php
- https://www.themealdb.com/terms_of_use.php
- https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia
