# Tasks

## 1. Python-sidecar

- [x] 1.1 Maak gelockte Python-runtime, beveiligde verbinding-/tokenopslag en code-aanmelding met echte python-appie-client; test server- en verbindingsauth, encryptie, refresh en gescheiden verbindingen met gecontroleerde HTTP-contracten.
- [x] 1.2 Implementeer duurzame exportjobs, regelvoortgang, herhaalveiligheid, herstartgedrag en read-only herstel; test dubbele verzoeken, gedeeltelijke fouten en een door AH verwerkte write zonder antwoord.
- [x] 1.3 Corrigeer het tekstregelcontract van de vastgepinde client en toon veilige HTTP-/fasefouten; verifieer met strikte transporttests, bouw de sidecar opnieuw en controleer de bestaande live verbinding alleen lezend.

## 2. Appintegratie

- [x] 2.1 Voeg optionele envconfiguratie, compose-runtime en AH ShoppingTarget toe; test servervalidatie, providercontracten, jobstatus en het ontbreken van automatische schrijfretries.
- [x] 2.2 Bouw mobiele AH-aanmeld-/ontkoppelflow voor eigenaren en voortgang in exporthistorie; test rechten, ontbrekende configuratie en de gebruikersflow via een gecontroleerde sidecar op 360 px.
- [x] 2.3 Documenteer opstarten, aanmelding, datavolume, experimentele beperkingen en verificatie in README; controleer de beschreven commando's en onderscheid contracttests van live AH-gebruik.

## 3. Integratie

- [x] 3.1 Draai Pythonchecks, lint/typecheck en alle app-/integratie-/browsertests, bouw en start de sidecar lokaal en controleer health en MCP-doelstatus; rapporteer of een live AH-aanmelding beschikbaar is.

## Workflow follow-up

- Archiveer na review met synchronisatie naar de hoofd-specs.
