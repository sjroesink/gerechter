# Proposal

## Why

De gebruiker wil afbeeldingen per ingrediënt en zoekt een gratis bron voor recepten met gerechtfoto's. Gerechten hebben al een foto-URL; ingrediënten hebben nog geen eigen beeld of bronvermelding.

## What Changes

- Een optionele afbeelding met bron, credit en gebruiksvoorwaarden per ingrediënt, beheerd met de bestaande catalogusrechten via UI en MCP.
- Herkenbare thumbnails in catalogus, kiezer, voorraad, receptingrediënten en boodschappen; afbeelding en bronvermelding op de ingrediëntpagina.
- Bestaande ingrediënten krijgen via de aangemelde MCP-client gecontroleerde passende TheMealDB-afbeeldingen. Bestaande foto's blijven behouden.
- Documentatie over TheMealDB voor persoonlijk gebruik en Wikimedia Commons als alternatief met licentie per bestand.

## Capabilities

### New Capabilities

- `ingredient-images`: optioneel beeld en herkomst per ingrediënt, met dezelfde zichtbaarheid en rechten als de catalogus.

### Modified Capabilities

Geen hoofd-specs aanwezig. De bestaande catalogusregels blijven leidend.

## Impact

Additieve migratie, catalogusvalidatie/presentatie, bestaande MCP-tools en UI-componenten. Geen nieuwe externe runtimeafhankelijkheid of automatische import van een volledige receptenbank. Recepten en planning blijven behouden.
