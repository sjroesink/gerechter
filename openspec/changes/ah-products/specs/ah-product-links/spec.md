## Purpose

Laat een huishouden ingrediënten koppelen aan echte Albert Heijn-producten, zodat een AH-export de gekozen producten in een berekend aantal op de AH-boodschappenlijst zet in plaats van vrije tekst.

## ADDED Requirements

### Requirement: Productkoppeling per huishouden en ingrediënt
Ieder lid van een huishouden SHALL een zichtbaar ingrediënt (globaal of eigen) aan hoogstens één AH-product kunnen koppelen, en die koppeling kunnen wijzigen of verwijderen. Een koppeling MUST alleen voor het eigen huishouden gelden en voor andere huishoudens onzichtbaar en onwijzigbaar zijn. Een gearchiveerd ingrediënt behoudt zijn koppeling.

#### Scenario: Globaal ingrediënt in twee huishoudens
- **WHEN** huishouden A het globale ingrediënt Tomaten koppelt aan product 1 en huishouden B aan product 2
- **THEN** gebruikt iedere export van A product 1 en iedere export van B product 2, en ziet geen van beide de koppeling van de ander

#### Scenario: Ongeldige of vreemde verwijzing
- **WHEN** een lid een ingrediënt koppelt dat niet zichtbaar is voor het huishouden, of een ongeldig product-ID of een niet-positieve inhoud opgeeft
- **THEN** wordt de koppeling geweigerd zonder te onthullen of het ingrediënt elders bestaat

### Requirement: Vastgelegde productgegevens
Een koppeling SHALL het AH-product-ID, de producttitel, de AH-inhoudsomschrijving, een optionele https-afbeelding en een optionele verpakkingsinhoud in de basiseenheid van het ingrediënt bewaren. Titel, afbeelding en prijs SHALL alleen ter informatie dienen en MUST niet automatisch worden bijgewerkt.

#### Scenario: Koppeling teruglezen
- **WHEN** een lid een gekoppeld ingrediënt opent
- **THEN** ziet het lid producttitel, inhoudsomschrijving, afbeelding en de vastgelegde verpakkingsinhoud

### Requirement: AH-producten zoeken
Het systeem SHALL leden met een ingestelde AH-verbinding in het AH-assortiment laten zoeken op vrije tekst, met per resultaat product-ID, titel, merk, inhoudsomschrijving, prijs, bonusaanduiding en afbeelding. Zoeken MUST niets aan de AH-lijst wijzigen. Zonder ingestelde AH-sidecar of AH-verbinding MUST zoeken een duidelijke melding geven.

#### Scenario: Geen verbinding
- **WHEN** een lid zoekt terwijl het huishouden geen AH-verbinding heeft
- **THEN** krijgt het lid de melding dat een eigenaar eerst AH moet koppelen

### Requirement: Voorstel voor verpakkingsinhoud
Bij het koppelen SHALL de AH-inhoudsomschrijving waar mogelijk worden omgezet naar een voorstel in de basiseenheid van het ingrediënt. Bij een onherkenbare omschrijving of een afwijkende dimensie MUST het voorstel leeg blijven; de gebruiker kan de inhoud altijd zelf aanpassen of leeg laten.

#### Scenario: Herkenbare inhoud
- **WHEN** een product "1 kg" heeft en het ingrediënt basiseenheid g
- **THEN** wordt 1000 als inhoud voorgesteld

#### Scenario: Inhoud in andere dimensie
- **WHEN** een product "500 ml" heeft en het ingrediënt basiseenheid g
- **THEN** wordt geen inhoud voorgesteld

### Requirement: Aantal verpakkingen berekenen
Voor ieder te kopen gekoppeld ingrediënt SHALL de boodschappenbehoefte het product en een aantal verpakkingen tonen: de benodigde hoeveelheid gedeeld door de verpakkingsinhoud, naar boven afgerond, met een maximum van 99. Er MUST geen eenheid of omrekening worden geraden. Basisvoorraad en volledig gedekte ingrediënten worden niet als product geëxporteerd.

#### Scenario: Afronden naar boven
- **WHEN** 700 g tomaten nodig is en de koppeling een inhoud van 500 g heeft
- **THEN** is het aantal 2 verpakkingen

### Requirement: Aantal controleren
Als het aantal niet berekend kan worden — geen verpakkingsinhoud of alleen vage of onbekende hoeveelheden — MUST het aantal 1 zijn en de regel als "aantal controleren" worden gemarkeerd. Bevat de behoefte naast een berekenbare hoeveelheid ook onbekende hoeveelheden, dan SHALL het berekende aantal gelden met dezelfde markering.

#### Scenario: Vage hoeveelheid
- **WHEN** alleen "1 snuf" van een gekoppeld ingrediënt nodig is
- **THEN** is het aantal 1 en wordt de regel als "aantal controleren" getoond

### Requirement: Gewijzigde koppeling maakt voorstel ongeldig
Een wijziging van product of verpakkingsinhoud van een koppeling MUST een eerder geopend boodschappenvoorstel ongeldig maken voor exporteren.

#### Scenario: Wijziging na voorstel
- **WHEN** een koppeling verandert nadat een boodschappenvoorstel is geopend
- **THEN** wordt exporteren van dat voorstel als gewijzigd geweigerd en moet een actueel voorstel worden geopend

### Requirement: Productexport naar de AH-boodschappenlijst
Een AH-export SHALL gekoppelde ingrediënten als productregels met AH-product-ID en aantal versturen en niet-gekoppelde ingrediënten als tekstregels zoals voorheen. Ingrediënten met hetzelfde product MUST tot één regel met opgeteld aantal worden samengevoegd. De export MUST eerst de lijst lezen: een product dat al in minstens het gevraagde aantal op de lijst staat wordt overgeslagen, een lager aantal wordt opgehoogd tot het gevraagde aantal. Winkelmandje en bestellen MUST ongemoeid blijven.

#### Scenario: Gemengde export
- **WHEN** een gerecht gekoppelde uien en niet-gekoppelde verse kruiden bevat
- **THEN** komt het uienproduct met het berekende aantal en de kruiden als tekstregel op de AH-lijst

#### Scenario: Product al genoeg op de lijst
- **WHEN** het product al met aantal 2 op de AH-lijst staat en de export 2 verpakkingen vraagt
- **THEN** wordt voor dat product niets geschreven en staat het met aantal 2 op de lijst

#### Scenario: Te weinig op de lijst
- **WHEN** het product al met aantal 1 op de AH-lijst staat en de export 2 verpakkingen vraagt
- **THEN** staat het product na de export met aantal 2 op de lijst

### Requirement: Herhalen naar AH zonder herhaalkeuze
Omdat een AH-export alleen aanvult wat nog ontbreekt, SHALL een nieuwe AH-export van een eerder geëxporteerde of onzekere bron zonder expliciete herhaalkeuze mogelijk zijn. Tijdens een nog lopende AH-export van dezelfde bron MUST een nieuwe export worden geweigerd. Voor delen en Notion blijft de bestaande herhaalbescherming gelden.

#### Scenario: Gerecht opnieuw naar AH
- **WHEN** een lid een gerecht dat al naar AH is geëxporteerd opnieuw naar AH stuurt
- **THEN** start de export zonder herhaalkeuze en blijven regels die al op de lijst staan ongewijzigd

### Requirement: Herhaalveiligheid van productregels
De bestaande exportgaranties MUST ook voor productregels gelden: dezelfde export-ID met dezelfde inhoud schrijft niet opnieuw, voortgang wordt per regel duurzaam bewaard, na een mogelijk uitgevoerde schrijfactie wordt niet automatisch verder of opnieuw geschreven, en fouten bevatten geen geheimen of ruwe AH-antwoorden.

#### Scenario: Onzeker productresultaat controleren
- **WHEN** het antwoord op een productregel wegvalt en later een statuscontrole wordt gedaan
- **THEN** wordt de regel alleen bevestigd als het product minstens met het beoogde eindaantal op de lijst staat, en wordt er niets opnieuw verstuurd

### Requirement: Koppelen in de app
De app SHALL op de ingrediëntpagina een AH-productsectie tonen om te zoeken, koppelen, inhoud aan te passen en te ontkoppelen, en in het boodschappenoverzicht bij AH als doel per te kopen ingrediënt product en aantal of een koppelactie tonen. Dit SHALL alleen verschijnen als de AH-sidecar is ingesteld en MUST bruikbaar zijn vanaf 360 px met aanraakdoelen van minimaal 44×44 px.

#### Scenario: Koppelen tijdens exporteren
- **WHEN** een lid in het boodschappenoverzicht bij een niet-gekoppeld ingrediënt een product kiest
- **THEN** wordt de koppeling opgeslagen en toont een vernieuwd voorstel het product met berekend aantal

### Requirement: Koppelen via MCP
MCP SHALL tools bieden om AH-producten te zoeken en een ingrediënt te koppelen of ontkoppelen, en ingrediënt- en boodschappenreads SHALL de koppeling tonen. UI en MCP MUST dezelfde domeinregels en huishoudafscherming gebruiken.

#### Scenario: Agent koppelt ingrediënten
- **WHEN** een MCP-client producten zoekt en een ingrediënt koppelt
- **THEN** toont een daaropvolgende ingrediënt- of boodschappenread via MCP dezelfde koppeling als de app

### Requirement: Product wisselen vanuit lijst en boodschappen
Bij ingestelde AH-sidecar en een AH-verbinding SHALL de ingrediëntenlijst per ingrediënt het gekoppelde product tonen met een actie om een product te koppelen of te wisselen, en SHALL het boodschappenoverzicht bij een gekoppeld ingrediënt een actie tonen om het product te wisselen. Wisselen MUST dezelfde zoek- en koppelregels gebruiken als eerste keer koppelen.

#### Scenario: Wisselen in de ingrediëntenlijst
- **WHEN** een lid in de ingrediëntenlijst bij een gekoppeld ingrediënt voor een ander product kiest
- **THEN** toont de lijst daarna het nieuwe product en gebruikt een volgend boodschappenvoorstel dat product

#### Scenario: Wisselen tijdens exporteren
- **WHEN** een lid in het boodschappenoverzicht bij een gekoppeld ingrediënt een ander product kiest
- **THEN** toont een vernieuwd voorstel het nieuwe product met opnieuw berekend aantal
