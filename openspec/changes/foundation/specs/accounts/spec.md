# Spec Delta

## Purpose

Beheert wie toegang heeft tot Gerechter: gebruikersaccounts, inloggen, registratie die alleen via een uitnodiging kan, en de platformbeheerder die het systeem opzet.

## ADDED Requirements

### Requirement: Inloggen met e-mail en wachtwoord
Het systeem SHALL gebruikers laten inloggen met hun e-mailadres en wachtwoord en daarna een sessie aanmaken die bewaard blijft tot de gebruiker uitlogt of de sessie verloopt.

#### Scenario: Geldige inloggegevens
- **WHEN** een gebruiker een bekend e-mailadres en het juiste wachtwoord invult
- **THEN** is de gebruiker ingelogd en komt die op de weekpagina van het actieve huishouden

#### Scenario: Ongeldige inloggegevens
- **WHEN** een gebruiker een onbekend e-mailadres of een fout wachtwoord invult
- **THEN** weigert het systeem de inlog met een algemene foutmelding die niet verraadt of het e-mailadres bestaat

### Requirement: Uitloggen
Het systeem SHALL een ingelogde gebruiker laten uitloggen, waarbij de sessie ongeldig wordt.

#### Scenario: Gebruiker logt uit
- **WHEN** een ingelogde gebruiker kiest voor uitloggen
- **THEN** is de sessie beëindigd en komt de gebruiker op de inlogpagina

### Requirement: Registratie alleen via uitnodiging
Het systeem SHALL geen open registratie toestaan. Een nieuw account kan alleen worden aangemaakt met een geldige, niet-verlopen en nog niet gebruikte uitnodiging, of via de eenmalige beheerder-bootstrap.

#### Scenario: Registreren zonder uitnodiging
- **WHEN** iemand probeert een account aan te maken zonder geldige uitnodiging
- **THEN** weigert het systeem de registratie en wordt er geen account aangemaakt

#### Scenario: Registreren met geldige uitnodiging
- **WHEN** iemand een geldige uitnodigingslink opent en een naam, e-mailadres en wachtwoord invult
- **THEN** wordt het account aangemaakt, is de gebruiker ingelogd en is de uitnodiging verbruikt

#### Scenario: Verlopen uitnodiging
- **WHEN** iemand een uitnodigingslink opent waarvan de geldigheid is verlopen
- **THEN** meldt het systeem dat de uitnodiging verlopen is en is registreren niet mogelijk

### Requirement: Eenmalige bootstrap van de platformbeheerder
Het systeem SHALL, zolang er nog geen enkel account bestaat, precies één account laten aanmaken met het e-mailadres uit de configuratie. Dat account krijgt de rol platformbeheerder en een eigen eerste huishouden.

#### Scenario: Eerste start met geconfigureerd beheerder-e-mailadres
- **WHEN** er nog geen accounts bestaan en iemand de setuppagina gebruikt met het geconfigureerde beheerder-e-mailadres
- **THEN** wordt dat account aangemaakt als platformbeheerder, met een nieuw huishouden waarvan die eigenaar is

#### Scenario: Ander e-mailadres bij bootstrap
- **WHEN** er nog geen accounts bestaan en iemand de setuppagina gebruikt met een ander e-mailadres dan het geconfigureerde
- **THEN** weigert het systeem het aanmaken van het account

#### Scenario: Setuppagina na bootstrap
- **WHEN** er al minstens één account bestaat en iemand de setuppagina opent
- **THEN** is de setuppagina niet beschikbaar

### Requirement: Platformbeheerder nodigt nieuwe huishoudens uit
Het systeem SHALL een platformbeheerder een uitnodiging laten aanmaken voor een nieuw huishouden. Wie de uitnodiging accepteert, wordt eigenaar van een nieuw aangemaakt huishouden.

#### Scenario: Beheerder maakt huishouden-uitnodiging
- **WHEN** een platformbeheerder een uitnodiging voor een nieuw huishouden aanmaakt met een voorgestelde huishoudnaam
- **THEN** krijgt de beheerder een deelbare link die 7 dagen geldig is

#### Scenario: Uitnodiging voor nieuw huishouden accepteren
- **WHEN** iemand met een huishouden-uitnodiging een account aanmaakt
- **THEN** wordt er een nieuw huishouden aangemaakt met die persoon als eigenaar, en is dat het actieve huishouden

#### Scenario: Geen beheerder
- **WHEN** een gebruiker zonder de rol platformbeheerder een huishouden-uitnodiging probeert aan te maken
- **THEN** weigert het systeem de actie

### Requirement: Wachtwoordherstel zonder e-mail
Het systeem SHALL een platformbeheerder een eenmalige herstellink laten aanmaken voor een account, waarmee de gebruiker een nieuw wachtwoord kan instellen. Bestaande sessies van dat account vervallen daarbij.

#### Scenario: Herstellink gebruiken
- **WHEN** een gebruiker een geldige herstellink opent en een nieuw wachtwoord instelt
- **THEN** kan de gebruiker met het nieuwe wachtwoord inloggen, zijn eerdere sessies ongeldig en is de link verbruikt

#### Scenario: Herstellink verlopen
- **WHEN** een gebruiker een herstellink opent die ouder is dan 24 uur
- **THEN** meldt het systeem dat de link verlopen is en blijft het wachtwoord ongewijzigd
