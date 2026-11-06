## Purpose

Levert een controleerbare boodschappenbehoefte uit recepten en planning, met consistente porties en voorraadverrekening zonder onzekere hoeveelheden exact te maken.

## ADDED Requirements

### Requirement: Behoefte per gerecht dag of week
Het systeem SHALL behoefte voor één gerecht met gekozen porties, één geplande dag of een kalenderweek berekenen. Bekende hoeveelheden van hetzelfde ingrediënt MUST worden opgeteld in de basiseenheid en de getelde voorraad MUST één keer van het totaal worden afgetrokken, met een minimum van nul. Basisvoorraad SHALL afzonderlijk worden uitgesloten en zichtbaar blijven als uitsluiting.

#### Scenario: Gedeeld ingrediënt in meerdere gerechten
- **WHEN** twee geplande gerechten samen 700 gram tomaat vereisen en 200 gram is geteld
- **THEN** toont het systeem 500 gram als boodschappenbehoefte

#### Scenario: Basisvoorraad
- **WHEN** een benodigd ingrediënt als altijd in huis is gemarkeerd
- **THEN** verschijnt het onder basisvoorraaduitsluitingen en niet als te kopen hoeveelheid

### Requirement: Onbekende hoeveelheden blijven zichtbaar
Het systeem MUST vage, onbekende en niet omrekenbare receptregels expliciet als controlepunten opnemen zonder hoeveelheden te gokken. Een exact bekend deel en een onbekend deel SHALL naast elkaar zichtbaar blijven. Getelde voorraad MUST niet van een onbekende eenheid worden afgetrokken.

#### Scenario: Blik zonder omrekening
- **WHEN** het recept één blik bonen noemt maar geen verhouding naar gram bestaat
- **THEN** noemt de lijst één blik met ‘omrekening onbekend’ en rekent het systeem dit niet om naar gram

### Requirement: Alleen nog benodigde geplande maaltijden
Het systeem SHALL vrije planningitems en al als gemaakt geregistreerde geplande maaltijden uitsluiten van dag- en weekbehoefte, met zichtbare toelichting. Een rechtstreeks gekozen recept SHALL ongeacht eerdere bereidingen opnieuw berekend kunnen worden. De berekening MUST voorraad en planning ongewijzigd laten.

#### Scenario: Gemaakt gepland gerecht
- **WHEN** een geplande maaltijd al een bereiding heeft
- **THEN** telt deze niet opnieuw mee voor dag/weekboodschappen en is de reden zichtbaar

### Requirement: Afscherming en actuele broncontrole
Het systeem MUST behoefte uitsluitend uit zichtbare recepten en planning van het actieve huishouden afleiden. Een export MUST weigeren als de gecontroleerde behoefte sinds het getoonde voorstel is veranderd.

#### Scenario: Voorraad na voorstel gewijzigd
- **WHEN** de voorraad of relevante broninhoud de behoefte na het voorstel verandert
- **THEN** vraagt export om een actueel voorstel en wordt geen verouderde lijst verzonden
