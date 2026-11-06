/** Shared by initialize.instructions and the read-only discovery tool. No household or provider secrets. */
export const agentGuide = {
  version: 1,
  language: 'nl',
  context: [
    'Elke tool werkt namens de OAuth-gebruiker in diens actuele actieve huishouden. Controleer whoami vóór een reeks wijzigingen en opnieuw bij twijfel.',
    'list_households toont uitsluitend eigen lidmaatschappen. switch_household vereist een expliciete gewenste keuze en wijzigt ook de bewaarde keuze in de webapp en andere clients.',
    'Iedere volgende aanroep controleert de context opnieuw. Een gelijktijdige wissel door de gebruiker kan die veranderen; voeg geen willekeurige householdId toe aan inhoudelijke tools.',
    'Een platformbeheerder krijgt via inhoudelijke tools geen toegang tot privégegevens van andere huishoudens.',
  ],
  workflows: {
    context: ['whoami', 'list_households', 'switch_household', 'get_agent_guide'],
    catalog: [
      'list_units',
      'search_ingredients',
      'get_ingredient',
      'create_ingredient',
      'update_ingredient',
      'set_ingredient_archived',
      'set_ingredient_conversion',
      'remove_ingredient_conversion',
    ],
    recipes: [
      'get_instruction_format',
      'fetch_recipe_from_url',
      'search_recipes',
      'get_recipe',
      'create_recipe',
      'update_recipe',
      'set_recipe_archived',
    ],
    pantry: [
      'get_pantry',
      'get_pantry_item',
      'set_pantry_item',
      'remove_pantry_item',
      'get_pantry_history',
      'get_household_preferences',
      'set_household_preferences',
    ],
    planning: [
      'get_week_plan',
      'get_day_plan',
      'get_planned_meal',
      'create_planned_meal',
      'update_planned_meal',
      'remove_planned_meal',
    ],
    cooking: [
      'prepare_cooking',
      'record_made',
      'search_cooking_history',
      'get_made_event',
      'set_my_made_rating',
    ],
    shopping: [
      'prepare_shopping',
      'get_shopping_targets',
      'start_shopping_export',
      'confirm_shopping_share',
      'list_shopping_exports',
      'get_shopping_export',
      'check_shopping_export',
    ],
    ahProducts: ['search_ah_products', 'link_ingredient_ah_product', 'unlink_ingredient_ah_product'],
  },
  rules: {
    search:
      'Zoek eerst kandidaten op naam, alias of tags en hergebruik passende IDs. Maak alleen iets nieuws als niets past; controleer ook bestaande voorbeelden en planning om duplicaten te voorkomen.',
    quantities:
      'Vraag list_units op. Basiseenheden zijn g, ml en stuk. Gebruik alleen bekende omrekeningen; onbekende hoeveelheden blijven null. Een snuf, handje of scheut wordt nooit automatisch een exact aantal grammen of een afboeking.',
    versions:
      'Lees vóór wijzigen de actuele versie. Bij conflict: lees opnieuw en behoud wijzigingen van anderen; forceer geen oude versie. Volledige vervangingen vragen de volledige gewenste inhoud. Gerechten en ingrediënten worden gearchiveerd, niet gewist.',
    instructions:
      'Vraag get_instruction_format op vóór instructies schrijven. Vaste secties: voorbereiding, bereiding, serveren en notities. Alleen RecipeSteps, Step, Tip, Timer en Checklist in OpenUI; geen dynamische expressies, queries, mutaties of externe acties. Ingrediënten komen uit echte receptregels.',
    import:
      'Een recept van een URL: fetch_recipe_from_url levert een concept en slaat niets op. Bestaat existingRecipe al, gebruik dat dan. Koppel elke ingrediëntregel aan een echt ingrediënt (search_ingredients, alleen bij geen match create_ingredient). Zet hoeveelheden alleen om als ze eenduidig zijn; anders quantity null en de originele tekst in note. Verzin geen stappen of hoeveelheden. Sla op met create_recipe, met sourceUrl uit het concept en photoUrl = imageUrl; de server bewaart de foto zelf. Meld een photoWarning aan de gebruiker. Weigert de site het verzoek of ontbreekt structuur, lees de pagina dan zelf als je webtoegang hebt en sla op dezelfde manier op, met de oorspronkelijke URL als sourceUrl.',
    portions:
      'Een recept behoudt zijn opgeslagen porties. servings schaalt de weergave; scaledQuantity is geschaald, quantity blijft origineel. Planning met servings:null gebruikt de actuele huishoudstandaard. Datums zijn echte kalenderdagen YYYY-MM-DD.',
    pantry:
      'set_pantry_item vervangt de volledige telling en telt niet op. Lees get_pantry_item, gebruik version (0 voor nog niet geteld) en geef staple expliciet op. Basisvoorraad is een aparte keuze zonder verzonnen oneindige hoeveelheid.',
    cooking:
      'Vraag prepare_cooking op. Laat porties en de voorgestelde exacte afboekingen controleren en bevestig alleen op opdracht met record_made. Bewaar requestId, recept-/planningversies en pantryVersion per regel. Herhaal na een netwerkfout uitsluitend exact dezelfde inhoud en sleutel. Beoordelen betreft alleen de eigen persoon en wijzigt geen voorraad.',
    shopping:
      'Vraag prepare_shopping en get_shopping_targets op. Toon de te kopen regels en onbekende omrekeningen; exporteer alleen op expliciete opdracht met source, requestId en fingerprint uit dat voorstel. Voorraad wordt één keer afgetrokken; vrije en gemaakte geplande maaltijden tellen niet mee. Een losse receptkeuze is een aparte bron.',
    exportRecovery:
      'Lees bij een onzeker resultaat get_shopping_export en gebruik check_shopping_export voor een read-only controle. Geen automatische nieuwe export of allowRepeat:true. Herhaal dezelfde aanvraag met dezelfde sleutel; een bewuste nieuwe export vereist controle en opdracht. Dag en week kunnen dezelfde bronclaims hebben.',
    share:
      'Een share-run zet tekst alleen klaar. confirm_shopping_share mag uitsluitend na werkelijk kopiëren, afronden van een deelmenu of annuleren. Gekopieerd en Deelmenu afgerond bewijzen geen ontvangst bij een ander.',
    providers:
      'Een eigenaar stelt Notion en AH in de webapp in. Vraag geen tokens, sleutels of AH-wachtwoord via MCP. AH is experimenteel en schrijft alleen naar de AH-boodschappenlijst, nooit naar winkelmandje of bestelling. Ontbrekende verbindingen zijn geen geslaagde live providercontrole.',
    ahProducts:
      'Een ingrediënt kan per huishouden aan één AH-product gekoppeld zijn. Zoek met search_ah_products (met ingredientId) en koppel met link_ingredient_ah_product alleen een product dat bij het ingrediënt en de wens van de gebruiker past; raad geen verpakkingsinhoud (packAmount null als suggestedPackAmount ontbreekt of twijfelachtig is). prepare_shopping toont per item ahProduct (aantal verpakkingen, check = aantal controleren) en ahItems; een AH-export stuurt gekoppelde producten met dat aantal, opgeteld bij wat al op de lijst staat, en de rest als tekst.',
  },
} as const

export const agentInstructions = JSON.stringify(agentGuide)
