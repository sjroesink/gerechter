# Spec Delta

## Purpose

Geeft hoeveelheden in recepten, voorraad en boodschappen een consistente betekenis, zonder ontbrekende of onbetrouwbare omrekeningen te verbergen.

## ADDED Requirements

### Requirement: Vaste eenheden met dimensies
Het systeem SHALL een vaste lijst eenheden met Nederlandse labels en dimensies massa, volume, aantal en vaag aanbieden. Elk ingrediënt SHALL een basiseenheid gram, milliliter of stuk hebben. Onbekende eenheden, negatieve en niet-eindige hoeveelheden SHALL worden geweigerd.

#### Scenario: Eenheden kiezen
- **WHEN** een gebruiker of agent de beschikbare eenheden opvraagt
- **THEN** krijgt die de vaste lijst met labels en dimensies terug

### Requirement: Standaardomrekeningen
Het systeem SHALL massa en volume via hun vaste verhoudingen omrekenen, waaronder kilogram naar gram, liter naar milliliter en theelepel/eetlepel naar 5/15 milliliter. Het SHALL verschillende aantaleenheden zoals blik en pak niet zonder ingrediëntspecifieke informatie gelijkstellen.

#### Scenario: Massa omrekenen
- **WHEN** twee kilogram wordt omgerekend voor een ingrediënt met basiseenheid gram
- **THEN** is de uitkomst 2000 gram

#### Scenario: Containers niet raden
- **WHEN** een blik moet worden omgerekend en geen ingrediëntspecifieke verhouding beschikbaar is
- **THEN** meldt het systeem dat de omrekening ontbreekt

### Requirement: Ingrediëntspecifieke omrekeningen
Het systeem SHALL bevoegde catalogusbeheerders per ingrediënt positieve omrekeningen naar de basiseenheid laten opslaan en intrekken. Dezelfde verhoudingen SHALL gelden voor compatibele massa- of volumeeenheden. Omrekeningen voor eigen ingrediënten SHALL alleen binnen het eigen huishouden toegankelijk zijn.

#### Scenario: Blik en dichtheid
- **WHEN** een blik tomaten is vastgelegd als 400 gram en een milliliter olie als 0,9 gram
- **THEN** levert twee blikken 800 gram op en één liter olie 900 gram

#### Scenario: Omrekening intrekken
- **WHEN** een bevoegde gebruiker een ingrediëntspecifieke omrekening verwijdert
- **THEN** wordt die verhouding niet meer voor nieuwe berekeningen gebruikt

### Requirement: Ontbrekende en vage hoeveelheden
Het systeem SHALL een ontbrekende omrekening als onbekend teruggeven, zodat onvergelijkbare regels apart blijven. Vage eenheden zoals snuf, handje en scheut SHALL nooit automatisch naar een exacte hoeveelheid worden omgerekend, ook niet via een handmatig ingestelde verhouding.

#### Scenario: Vage hoeveelheid
- **WHEN** een snuf zout naar gram wordt omgerekend
- **THEN** blijft de exacte hoeveelheid onbekend en is automatische afboeking niet mogelijk
