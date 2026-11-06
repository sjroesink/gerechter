# Proposal

## Why

De boodschappenproviderinterface en exporthistorie zijn beschikbaar. De geplande experimentele AH-koppeling heeft een geïsoleerde Python-runtime nodig, zodat de webapp geen onofficiële AH-client of AH-aanmeldgegevens naar de browser hoeft te brengen.

## What Changes

- Interne Python-sidecar met de vastgepinde echte python-appie 0.2.2-client, optioneel te starten met compose.
- Een eigenaar koppelt AH via een browseraanmeldcode; tokens worden versleuteld per verbinding in de sidecar bewaard en automatisch vernieuwd.
- Bevestigde boodschappen worden als tekstregels met hun exacte omschrijving naar de AH-boodschappenlijst gestuurd, zonder product-, mandje- of bestelkeuzes te raden.
- Duurzame, herhaalveilige exportjobs met regelvoortgang en read-only herstel bij onzekere of gedeeltelijke resultaten.
- Aansluiting op ShoppingTarget, bestaande SyncRuns en mobiele verbindinginstellingen, met een duidelijke experimentele aanduiding.

## Capabilities

### New Capabilities

- `ah-shopping-sidecar`: afgeschermde AH-aanmelding en boodschappenexport via een interne Python-service.

### Modified Capabilities

Geen. De shopping-change heeft al een providerinterface, AH-doeltype en generieke statuscontrole.

## Impact

Python-service, dependencylock, Dockerfile en optionele compose-override; optionele serverconfiguratie, Node-provideradapter, verbindingsacties, UI en tests. Een live AH-aanmelding wordt niet verondersteld. De echte client wordt met gecontroleerde HTTP-contracten getest zonder het AH-account van de gebruiker te wijzigen.
