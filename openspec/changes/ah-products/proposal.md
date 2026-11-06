# Proposal

## Why

De AH-export zet boodschappen nu als vrije tekstregels op de AH-lijst, zodat je in de AH-app per regel alsnog zelf een product moet zoeken. Door ingrediënten eenmalig aan een echt AH-product te koppelen, komen bij het exporteren van een gerecht, dag of week direct de juiste producten in het juiste aantal op de lijst.

## What Changes

- Per huishouden kan ieder ingrediënt (globaal of eigen) aan één AH-product worden gekoppeld, met de verpakkingsinhoud in de basiseenheid van het ingrediënt.
- Zoeken in het AH-assortiment via de bestaande AH-verbinding van het huishouden, in de app (ingrediëntpagina en boodschappenoverzicht) en via MCP.
- De boodschappenbehoefte toont per regel het gekoppelde product en het berekende aantal verpakkingen (naar boven afgerond). Niet te berekenen aantallen worden 1 stuk met een zichtbare melding; er wordt niets geraden.
- De AH-export stuurt gekoppelde ingrediënten als productregels (product-ID + aantal), opgeteld bij een al aanwezig aantal van hetzelfde product. Niet-gekoppelde ingrediënten blijven tekstregels zoals nu.
- Nieuwe MCP-tools: AH-producten zoeken, ingrediënt koppelen en ontkoppelen; bestaande ingrediënt- en boodschappenreads tonen de koppeling.
- De tekstexport-eis uit de nog niet gearchiveerde change `ah-sidecar` ("product- en bestelkeuzes ongewijzigd laten") wordt voor gekoppelde ingrediënten vervangen door een expliciete, door de gebruiker gekozen productkoppeling. Bestellen en het winkelmandje blijven buiten scope.

## Capabilities

### New Capabilities

- `ah-product-links`: koppelingen tussen ingrediënten en AH-producten per huishouden, productzoeken, aantalberekening en productexport naar de AH-boodschappenlijst.

### Modified Capabilities

Geen in `openspec/specs/` (nog leeg). Het tekstexportgedrag van de niet-gearchiveerde change `ah-sidecar` wordt aangevuld door `ah-product-links`; bij archiveren moet de tekstexport-eis daarop worden afgestemd.

## Impact

- Postgres: nieuwe tabel `ingredient_ah_product` (additieve migratie).
- Domein: nieuwe module voor koppelingen en aantalberekening; `ShoppingNeeds` krijgt productinformatie en AH-regels (onderdeel van de fingerprint en snapshot).
- Server: AH-sidecarclient krijgt productzoeken en productregels in de export; server functions voor zoeken/koppelen.
- Sidecar (Python): zoekendpoint, exportinvoer met productregels, SQLite-kolommen voor product-ID en aantallen, herstelcontrole op aantal.
- UI: AH-productsectie op de ingrediëntpagina, gedeeld zoekscherm, productweergave en koppelknop in het boodschappenoverzicht.
- MCP: drie nieuwe tools en uitgebreide reads.
- Tests: domein, afscherming, Python-transportcontracten, MCP en browser.
