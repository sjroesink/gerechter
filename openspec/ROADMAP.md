# Gerechter: volledige applicatie

Doel bevestigd op 5 november 2026: de volledige geplande app bouwen en verifiëren, daarna voorbeeldgerechten via de aangemelde MCP-koppeling toevoegen. De scope is de overall architectuur in `changes/foundation/design.md`.

Uitbreiding op verzoek van de gebruiker: voeg via de aangemelde MCP-koppeling **in totaal tien gerechten** toe aan het actieve huishouden (de drie bestaande voorbeelden tellen mee) en bereid **een volledige weekplanning met zeven avondmaaltijden** voor. Lees gerechten en planning via MCP terug als bewijs; behoud bestaande planning en voorkom dubbele items. Voorgestelde week: maandag 9 t/m zondag 15 november 2026, tenzij de gebruiker een andere week kiest. Eetvoorkeuren/allergieën zijn opgevraagd; de echte huishoudstandaard bepaalt de porties.

| Change | Inhoud | Stand |
| --- | --- | --- |
| foundation | Accounts, huishoudens, OAuth/MCP, mobiele schil, deployment | 36/36 afgerond; nog niet gearchiveerd |
| catalog | Globale/eigen ingrediënten, aliassen, zoeken, eenheden en omrekeningen, UI en MCP | 8/8 afgerond; 84 unit-/integratietests en 27 browsertests groen |
| recipes | Gerechten, ingrediëntenlijsten, porties, tags, archivering, vaste instructies en beperkte OpenUI-componenten; UI en MCP | 9/9 afgerond; 111 unit-/integratietests en 29 browsertests groen; drie voorbeelden via echte MCP aangemaakt en teruggelezen |
| pantry | Voorraad en basisvoorraad per huishouden, standaardporties en mutaties | 8/8 afgerond; 120 unit-/integratietests en 32 browsertests groen; zeven nieuwe tools via echte OAuth-client ontdekt |
| planning | Week/dagplanning met gerechten en vrije items zoals restjes/bestellen, portie-overschrijvingen | 6/6 afgerond; 132 unit-/integratietests en 34 browsertests groen; zes nieuwe tools via echte OAuth-client ontdekt |
| cooking-history | Gemaakt registreren, beoordeling per persoon, aanpasbare exacte voorraadafboekingen | 7/7 afgerond; 144 unit-/integratietests en 36 browsertests groen; vijf nieuwe tools via echte OAuth-client ontdekt |
| shopping | Behoefteberekening, Delen en Notion, sync per gerecht/dag/week, SyncRun-historie tegen dubbel toevoegen | 8/8 afgerond; 175 unit-/integratietests en 40 browsertests groen; zeven nieuwe tools via echte OAuth-client ontdekt. Notion-contracten getest, lokaal nog geen live verbinding ingesteld |
| mcp-tools | Alle resterende inhoudelijke agentacties, huishoudwisselen en instructiecomponentdocumentatie | 5/5 afgerond; 43 tools via echte OAuth-client, tien gerechten en zeven geplande dagen toegevoegd en teruggelezen |
| ah-sidecar | Experimentele AH-provider via een interne Python-sidecar met python-appie | 7/7 afgerond; 23 Python-tests en 10 gerichte Node-contracttests groen na tekstpayloadcorrectie; Docker gezond, live account uitleesbaar; nieuwe live export nog niet getest |
| recipe-import | Aanvullend verzoek: recept importeren van een URL via MCP (`fetch_recipe_from_url`), eigen kopie van gerechtfoto's met bronverwijzing, SSRF-veilige uitgaande fetch | 6/7 afgerond; 244 TypeScript-tests en 47 browsertests groen, live uitgelezen van leukerecepten.nl en BBC Good Food (AH Allerhande weigert met 403); import via de echte aangemelde MCP-client nog te doen |
| ingredient-images | Aanvullend verzoek: afbeeldingen per ingrediënt met bronvermelding, UI en MCP | 5/5 afgerond; 199 TypeScript-tests en 47 browsertests voor de basis, plus 23 gerichte tests en echte mobiele browsercontrole voor boodschappenfoto's; 38 bestaande ingrediënten via MCP van gecontroleerde beelden voorzien |

## Doorlopende eisen

- Bedrijfsregels en validatie in de domeinlaag; UI en MCP gebruiken dezelfde functies en dezelfde actuele gebruikerscontext.
- Huishoudgegevens zijn alleen zichtbaar en wijzigbaar voor leden. Aangepaste ID's lekken geen gegevens.
- Ontbrekende omrekeningen worden niet geraden; vage eenheden worden nooit automatisch afgeboekt.
- Gerechten en ingrediënten worden gearchiveerd met behoud van verwijzingen.
- Instructies gebruiken vaste secties; de ingrediëntensectie wordt uit de echte receptregels afgeleid. OpenUI is beperkt tot een expliciete componentbibliotheek.
- Mobiel vanaf 360 px met aanraakdoelen van minimaal 44×44 px; licht/donker/systeem blijven werken.
- Bestaande accounts en data blijven behouden; de app blijft bereikbaar via main-pc:3000.
- Iedere change krijgt actuele specificaties, taken en passende domein-, afschermings-, MCP- en browserverificatie.
- Externe providers worden echt geïmplementeerd. Voor een live providercontrole kan nog een door de gebruiker ingestelde verbinding nodig zijn; ontbrekende verbindingen worden niet als geslaagde integraties gerapporteerd.
- Voorbeeldgerechten worden via de echte, aangemelde MCP-client in het actieve huishouden gemaakt en daarna teruggelezen.

## Verificatie tot nu toe

Catalogus: additieve migratie toegepast op de bestaande lokale database, lint/typecheck geslaagd, 84 unit-/integratietests en 27 browsertests geslaagd. De echte Codex-client ontdekt negen tools (whoami plus acht catalogustools), is via OAuth verbonden en toont het juiste actieve huishouden.

Recepten: additieve migratie toegepast, lint/typecheck geslaagd, 111 unit-/integratietests en 29 browsertests geslaagd. Mobiele dark-modeweergave visueel gecontroleerd. De aangemelde Codex-MCP-client heeft pasta met tomatensaus, kikkererwtencurry met spinazie en groenteomelet aangemaakt in het huishouden van Sander Roesink en alle drie teruggelezen, inclusief ingrediënten en vaste instructies. De bestaande accounts en OAuth-koppeling bleven behouden.

Voorraad: additieve migratie uitgevoerd, lint/typecheck en alle 120 unit-/integratietests en 32 browsertests geslaagd. Tellingen, basisvoorraad, correcties, verwijderhistorie en portievoorkeuren zijn in UI en MCP getest. De echte OAuth-client is nog verbonden met hetzelfde huishouden en ontdekt de nieuwe tools.

Planning: additieve migratie uitgevoerd, lint/typecheck en alle 132 unit-/integratietests en 34 browsertests geslaagd. Jaargrenzen, zomertijd, porties, vrije items, archivering, conflicten en huishoudafscherming gecontroleerd. De aangemelde MCP-client ontdekt 28 tools, inclusief zes planningtools, en behoudt het juiste actieve huishouden.

Gemaakt/geschiedenis: additieve migratie uitgevoerd, lint/typecheck en alle 144 unit-/integratietests en 36 browsertests geslaagd. Atomaire afboekingen, herhaalveiligheid, conflicten, rollback, historische inhoud, persoonlijke beoordelingen en huishoudafscherming gecontroleerd. De aangemelde MCP-client ontdekt 33 tools, inclusief vijf nieuwe tools voor deze module.

Boodschappen: additieve migraties uitgevoerd, lint/typecheck en alle 175 unit-/integratietests en 40 browsertests geslaagd. Behoefte, gekopieerde/geannuleerde deelacties, bronoverlap, herhaalveiligheid, encryptie, Notion-contracten en herstel zonder dubbele writes zijn gecontroleerd. De echte MCP-client ontdekt 40 tools. Read-only gecontroleerd dat lokaal nog geen Notion-verbinding is ingesteld; een live Notion-export is dus niet uitgevoerd. Het op verzoek gewijzigde lokale beheerderswachtwoord is met een echte controlelogin geverifieerd; de OAuth-MCP-koppeling werkt nog.

Eindintegratie: **192 TypeScript-tests, 16 Python-tests en 43 mobiele browsertests** geslaagd; lint,
typecheck en strikte validatie van alle negen changes groen. De actuele appcontainer is gebouwd en gezond
gestart tegen de testdatabase; de AH-sidecar draait lokaal gezond. De gewone start- en migratiecommando's
lezen nu een aanwezige `.env`. De echte OAuth-client ontdekt 43 tools, de tien gerechten zijn teruggelezen
en de week 9–15 november 2026 bevat zeven avondmaaltijden voor de ingestelde twee personen. Ook in de
werkelijke mobiele webapp en systeemdonker thema gecontroleerd. `main-pc:3000` blijft bereikbaar. De
changes zijn niet gearchiveerd en de wijzigingen niet gecommit. Zie [het volledige verificatiebewijs](VERIFICATION.md)
voor de eisenmatrix, concrete recept-/planning-IDs en de beperkingen van de providercontrole.

Aanvulling: ingrediënten hebben nu een optionele foto met bron, credit en voorwaardenlink. De catalogus,
kiezer, voorraad en receptingrediënten tonen thumbnails; wijzigingen zonder `photo` behouden een bestaand
beeld en `photo: null` wist het. Alle 38 bestaande ingrediënten hebben een gecontroleerde afbeelding:
37 van TheMealDB en één publiek-domeinfoto van Wikimedia Commons. De echte mobiele browsercontrole en
MCP-teruglezing slagen. Zie [de beeldverificatie](changes/ingredient-images/verification.md) voor bewijs
en toelichting bij algemene illustraties en bronvoorwaarden.
