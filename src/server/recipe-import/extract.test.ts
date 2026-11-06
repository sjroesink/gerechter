import { describe, expect, test } from 'vitest'
import { decodeEntities, durationMinutes, extractRecipe } from './extract'

const page = (head: string, body = '<p>Lekker</p>') =>
  `<!doctype html><html><head><title>Titel van de pagina</title>${head}</head><body>${body}</body></html>`
const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`

describe('receptextractie', () => {
  test('leest een Recipe uit @graph met secties, ImageObject en ISO-duren', () => {
    const html = page(
      ld({
        '@context': 'https://schema.org',
        '@graph': [
          { '@type': 'WebSite', name: 'Kookblog' },
          {
            '@type': ['Recipe', 'NewsArticle'],
            name: 'Pasta &amp; pesto',
            description: '<p>Snelle  pasta</p>',
            recipeYield: ['4', '4 personen'],
            prepTime: 'PT15M',
            cookTime: 'PT1H5M',
            totalTime: 'P0DT1H20M',
            recipeIngredient: ['400 g pasta', '1 pot pesto &frac12;', ''],
            recipeInstructions: [
              {
                '@type': 'HowToSection',
                name: 'Saus',
                itemListElement: [{ '@type': 'HowToStep', text: 'Meng de pesto.' }],
              },
              { '@type': 'HowToStep', text: 'Kook de pasta.' },
            ],
            image: [{ '@type': 'ImageObject', url: '/img/pasta.jpg' }],
            keywords: 'Pasta, snel',
            recipeCategory: 'Hoofdgerecht',
            recipeCuisine: ['Italiaans'],
          },
        ],
      }),
    )
    const draft = extractRecipe(html, 'https://www.example.com/recepten/pasta')
    expect(draft).toMatchObject({
      structured: true,
      name: 'Pasta & pesto',
      description: 'Snelle pasta',
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 65,
      totalMinutes: 80,
      ingredientLines: ['400 g pasta', '1 pot pesto ½'],
      steps: [
        { section: 'Saus', text: 'Meng de pesto.' },
        { section: null, text: 'Kook de pasta.' },
      ],
      imageUrl: 'https://www.example.com/img/pasta.jpg',
      suggestedTags: ['pasta', 'snel', 'hoofdgerecht', 'italiaans'],
    })
    expect(draft.pageText).toBeUndefined()
  })

  test('verdraagt rauwe regelovergangen, tekstinstructies en og:image als terugval', () => {
    const html = page(
      `<meta property="og:image" content="https://cdn.example.com/og.png">` +
        `<script type="application/ld+json">{"@type":"Recipe","name":"Soep","recipeYield":"Voor 2 personen",
        "recipeInstructions":"Snijd de groente.
Kook 20 minuten.<br>Pureer."}</script>`,
    )
    const draft = extractRecipe(html, 'https://example.com/soep')
    expect(draft.servings).toBe(2)
    expect(draft.steps.map((step) => step.text)).toEqual(['Snijd de groente.', 'Kook 20 minuten.', 'Pureer.'])
    expect(draft.imageUrl).toBe('https://cdn.example.com/og.png')
  })

  test('slaat ongeldige JSON-LD over en vindt het recept in een later blok', () => {
    const html = page(
      `<script type="application/ld+json">{kapot</script>${ld({ '@type': 'Recipe', name: 'Taart' })}`,
    )
    expect(extractRecipe(html, 'https://example.com').name).toBe('Taart')
  })

  test('zonder Recipe: titel, afbeelding en leesbare paginatekst zonder scripts', () => {
    const html = page(
      `<meta property="og:title" content="Oma&#39;s stamppot"><meta name="description" content="Winterkost">` +
        `<meta property="og:image" content="javascript:alert(1)">`,
      `<nav>Menu</nav><h1>Stamppot</h1><script>var x = 1</script><ul><li>1 kg aardappels</li><li>Boerenkool</li></ul>`,
    )
    const draft = extractRecipe(html, 'https://example.com/stamppot')
    expect(draft).toMatchObject({
      structured: false,
      name: "Oma's stamppot",
      description: 'Winterkost',
      imageUrl: null,
      ingredientLines: [],
    })
    expect(draft.pageText).toBe('Stamppot\n1 kg aardappels\nBoerenkool')
  })

  test('hulpfuncties voor duur en entities', () => {
    expect(durationMinutes('PT0S')).toBeNull()
    expect(durationMinutes('30 minuten')).toBeNull()
    expect(durationMinutes('PT1H')).toBe(60)
    expect(decodeEntities('&amp;amp; &#233; &#x20AC; &onbekend;')).toBe('& é € &onbekend;')
  })
})
