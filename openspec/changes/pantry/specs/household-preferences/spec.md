## Purpose

Geeft huishoudens een gedeelde standaard voor het aantal personen dat mee-eet, zodat receptweergave en planning consistente porties voorstellen zonder opgeslagen recepten te veranderen.

## ADDED Requirements

### Requirement: Standaardporties per huishouden
Het systeem SHALL leden toestaan standaardporties voor hun actieve huishouden te lezen en wijzigen naar een geheel getal tussen 1 en 1000. Zonder opgeslagen voorkeur SHALL de waarde 2 zijn. Receptweergave SHALL deze waarde gebruiken tenzij expliciet andere porties zijn gekozen; het oorspronkelijke recept MUST ongewijzigd blijven.

#### Scenario: Voorkeur aanpassen
- **WHEN** een lid de standaard van 2 naar 4 wijzigt
- **THEN** krijgen andere leden van hetzelfde huishouden 4 als voorstel en blijven andere huishoudens op hun eigen voorkeur

#### Scenario: Expliciete portiekeuze
- **WHEN** de standaard 4 is en het lid voor de receptweergave 3 kiest
- **THEN** toont het systeem hoeveelheden voor 3 porties zonder de huishoudvoorkeur of het opgeslagen recept te wijzigen

#### Scenario: Ongeldige voorkeur
- **WHEN** een lid nul, een breuk of een waarde boven 1000 invoert
- **THEN** weigert het systeem de wijziging en blijft de eerdere voorkeur behouden
