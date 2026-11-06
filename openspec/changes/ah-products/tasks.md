# Tasks

## 1. Domein en data

- [x] 1.1 Voeg tabel `ingredient_ah_product` toe met Drizzle-migratie (uniek per huishouden/ingrediënt, checks op product-ID en inhoud); verifieer met `pnpm db:generate` en een geslaagde migratie op de testdatabase.
- [x] 1.2 Implementeer `parseUnitSize` en `ahQuantity` (afronden naar boven, max 99, vage/onbekende hoeveelheden → 1 + controleren, afwijkende dimensie → geen inhoud); unittests voor kg/g/l/ml/cl/stuks/"ca."/onherkenbaar en de spec-scenario's.
- [x] 1.3 Implementeer koppelen/ontkoppelen/lezen in de domeinlaag met huishoudafscherming en zichtbaarheidscontrole van ingrediënten; integratietests voor twee huishoudens op een globaal ingrediënt, vreemde ID's, ongeldige invoer en upsert.
- [x] 1.4 Breid de boodschappenbehoefte uit met `ahProduct` per item en `ahItems` (samenvoegen per product, fingerprint wijzigt bij gewijzigde koppeling, tekstregels voor niet-gekoppelde items); tests voor gemengde behoefte, gedeeld product, basisvoorraad en een export die na koppelwijziging als gewijzigd wordt geweigerd.

## 2. Python-sidecar

- [x] 2.1 Voeg productzoekendpoint toe met server-/verbindingsauth, lock en genormaliseerde, veilige response; tests met gecontroleerd HTTPX-transport voor resultaatmapping, ongeldige toegang en generieke fouten.
- [x] 2.2 Breid exportinvoer, invoerhash en SQLite-schema (met kolommigratie voor bestaande databases) uit met productregels; schrijf productregels als absoluut doelaantal (aanwezig + gevraagd) en bevestig onzekere productregels alleen bij aantal ≥ doel; strikte transporttests voor payload, optellen, samenvoegen, gedeeltelijke fout en herstel, plus een test op een bestaande oude database.

## 3. Server, MCP en UI

- [x] 3.1 Breid `ahSidecar` uit met `searchProducts` en productregels in `send` (terugval op `lines` voor oude snapshots), plus server-only verbindingsreferentie voor leden en server functions voor zoeken/koppelen; contracttests voor payload, responsevalidatie, ontbrekende configuratie/verbinding.
- [x] 3.2 Voeg MCP-tools `search_ah_products`, `link_ingredient_ah_product`, `unlink_ingredient_ah_product` toe en toon `ahProduct` in ingrediënt- en boodschappenreads; MCP-test voor ontdekken, koppelen en teruglezen.
- [x] 3.3 Bouw het gedeelde AH-productzoekscherm, de sectie op de ingrediëntpagina en product/aantal/koppelknop in het boodschappenoverzicht (alleen bij ingestelde sidecar); browsertest op 360 px met een gecontroleerde sidecar voor koppelen vanaf de ingrediëntpagina en vanuit het boodschappenoverzicht, en een gemengde export.

## 4. Integratie

- [x] 4.1 Werk README (AH-sectie) bij; draai Pythonchecks, lint, typecheck, alle TypeScript- en browsertests; bouw en start de sidecar lokaal en rapporteer of een live AH-zoekopdracht/export met een echte verbinding is gecontroleerd.

## Workflow follow-up

- Stem bij archiveren de tekstexport-eis van `ah-sidecar` af op `ah-product-links`.
