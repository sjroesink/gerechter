# Spec Delta

## Purpose

Legt de mobile-first navigatiestructuur van Gerechter vast: weinig informatie per scherm, liever een paar keer doorklikken, met een vaste plek voor de hoofdsecties.

## ADDED Requirements

### Requirement: Hoofdnavigatie met vier secties
Het systeem SHALL ingelogde gebruikers een vaste navigatiebalk onderin het scherm tonen met de secties Week, Gerechten, Voorraad en Meer. De actieve sectie SHALL zichtbaar gemarkeerd zijn.

#### Scenario: Wisselen van sectie
- **WHEN** een gebruiker in de navigatiebalk op Gerechten tikt
- **THEN** opent de startpagina van de sectie Gerechten en is Gerechten gemarkeerd als actief

#### Scenario: Sectie zonder inhoud
- **WHEN** een gebruiker een sectie opent waarvan de functionaliteit nog niet beschikbaar is
- **THEN** toont de pagina een lege staat met een korte uitleg, zonder foutmelding

### Requirement: Sectie Meer
Het systeem SHALL in de sectie Meer doorverwijzingen tonen naar het account, het huishouden (leden en uitnodigingen), verbonden MCP-clients en, voor platformbeheerders, het beheer.

#### Scenario: Gewone gebruiker opent Meer
- **WHEN** een gebruiker zonder beheerdersrol de sectie Meer opent
- **THEN** ziet die Account, Huishouden en Verbonden apps, maar geen Beheer

#### Scenario: Beheerder opent Meer
- **WHEN** een platformbeheerder de sectie Meer opent
- **THEN** ziet die ook Beheer

### Requirement: Drill-down met terugnavigatie
Het systeem SHALL detailpagina's tonen met een kop die de paginatitel en een terugknop naar het vorige niveau bevat. Elke pagina SHALL een eigen URL hebben, zodat de terugknop van browser of telefoon en directe links werken.

#### Scenario: Terug vanaf detailpagina
- **WHEN** een gebruiker vanuit Meer naar Huishouden gaat en daarna op de terugknop in de kop tikt
- **THEN** is de gebruiker terug in de sectie Meer

#### Scenario: Directe link
- **WHEN** een ingelogde gebruiker de URL van een detailpagina rechtstreeks opent
- **THEN** wordt die pagina getoond, met een werkende terugknop naar de bovenliggende pagina

### Requirement: Bruikbaar op mobiel
Het systeem SHALL alle pagina's bruikbaar maken vanaf een schermbreedte van 360 pixels zonder horizontaal scrollen, met aanraakdoelen van minstens 44 bij 44 pixels.

#### Scenario: Smal scherm
- **WHEN** een pagina wordt getoond op een scherm van 360 pixels breed
- **THEN** past de inhoud in de breedte en is elke knop en elk navigatie-element met een vinger te bedienen

### Requirement: Afgeschermde pagina's
Het systeem SHALL niet-ingelogde bezoekers alleen de inlogpagina, de setuppagina, uitnodigingspagina's en herstelpagina's tonen. Voor alle andere pagina's SHALL een bezoeker eerst inloggen en daarna terugkomen op de gevraagde pagina.

#### Scenario: Niet ingelogd naar beschermde pagina
- **WHEN** een niet-ingelogde bezoeker de pagina Huishouden opent
- **THEN** wordt de bezoeker naar de inlogpagina gestuurd en komt die na het inloggen op de pagina Huishouden
