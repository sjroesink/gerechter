# Spec Delta

## Purpose

Zorgt dat Gerechter met één commando lokaal draait en later zonder herontwerp op een eigen server (Unraid) gezet kan worden: configuratie via omgevingsvariabelen, persistente data en zichtbare gezondheid.

## ADDED Requirements

### Requirement: Starten met docker-compose
Het systeem SHALL met `docker compose up` starten als een app-service en een databaseservice, zonder verdere handmatige stappen dan het invullen van de omgevingsvariabelen.

#### Scenario: Eerste start
- **WHEN** een ontwikkelaar `.env.example` kopieert naar `.env`, de verplichte waarden invult en `docker compose up` uitvoert
- **THEN** is de app bereikbaar op de geconfigureerde poort en toont die de setuppagina voor de beheerder

### Requirement: Configuratie via omgevingsvariabelen
Het systeem SHALL alle configuratie die per omgeving verschilt (onder andere database-URL, publieke basis-URL, geheim voor sessies en tokens, beheerder-e-mailadres) uit omgevingsvariabelen lezen. Alle variabelen SHALL met uitleg in `.env.example` staan.

#### Scenario: Verplichte variabele ontbreekt
- **WHEN** de app start zonder een verplichte omgevingsvariabele
- **THEN** stopt de app direct met een foutmelding die de ontbrekende variabele noemt

### Requirement: Persistente data
Het systeem SHALL alle blijvende gegevens opslaan in volumes onder één gegevensmap, zodat containers vervangen kunnen worden zonder dataverlies en een back-up één map is.

#### Scenario: Containers opnieuw aanmaken
- **WHEN** de containers worden verwijderd en opnieuw gestart met dezelfde gegevensmap
- **THEN** zijn alle accounts, huishoudens en andere gegevens nog aanwezig

### Requirement: Databasemigraties bij opstarten
Het systeem SHALL bij het opstarten openstaande databasemigraties automatisch uitvoeren, voordat de app verzoeken aanneemt. Een mislukte migratie SHALL het opstarten stoppen.

#### Scenario: Nieuwe versie met migratie
- **WHEN** een nieuwe versie van de app start op een database met een oudere structuur
- **THEN** worden de openstaande migraties uitgevoerd en daarna start de app

#### Scenario: Migratie mislukt
- **WHEN** een migratie faalt
- **THEN** stopt de app met een foutmelding en neemt die geen verzoeken aan

### Requirement: Health-check
Het systeem SHALL een endpoint `/health` aanbieden dat aangeeft of de app draait en de database bereikbaar is, zodat containerorchestratie en monitoring de status kunnen bepalen.

#### Scenario: Alles in orde
- **WHEN** `/health` wordt opgevraagd terwijl de database bereikbaar is
- **THEN** antwoordt het systeem met status 200

#### Scenario: Database onbereikbaar
- **WHEN** `/health` wordt opgevraagd terwijl de database niet bereikbaar is
- **THEN** antwoordt het systeem met status 503
