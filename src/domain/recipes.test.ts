import { eq } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { image, recipe } from '~/db/schema'
import { setupTestDb } from '../../tests/db'
import { twoHouseholds } from '../../tests/fixtures'
import { Conflict, Invalid, NotFound } from './core'
import { createIngredient, setIngredientArchived, setIngredientConversion } from './catalog'
import { getImageForUser, sniffImageType, type FetchImage } from './images'
import { INSTRUCTION_EXAMPLE } from './instructions'
import {
  createRecipe,
  findRecipeBySourceUrl,
  getRecipe,
  searchRecipes,
  setRecipeArchived,
  updateRecipe,
  type RecipeInput,
} from './recipes'

const db = setupTestDb()
async function setup() {
  const { a, b } = await twoHouseholds(db)
  const rice = await createIngredient(a, { name: 'Rijst', baseUnit: 'g' })
  const salt = await createIngredient(a, { name: 'Zout', baseUnit: 'g' })
  const input: RecipeInput = {
    name: 'Rijstgerecht',
    servings: 2,
    tags: ['Vegetarisch'],
    ingredients: [
      { ingredientId: rice.id, quantity: 100, unit: 'g' },
      { ingredientId: salt.id, quantity: 1, unit: 'snuf' },
    ],
    sections: [{ id: 'cooking', text: 'Kook de rijst.', openUi: INSTRUCTION_EXAMPLE }],
  }
  return { a, b, rice, salt, input }
}

describe('recepten en hoeveelheden', () => {
  test('slaat een compleet recept op en schaalt de weergave zonder het origineel te wijzigen', async () => {
    const { a, input } = await setup()
    const created = await createRecipe(a, input)
    const scaled = await getRecipe(a, created.id, 4)
    expect(scaled).toMatchObject({
      name: 'Rijstgerecht',
      servings: 2,
      viewServings: 4,
      version: 1,
      tags: ['vegetarisch'],
    })
    expect(scaled.ingredients[0]).toMatchObject({
      quantity: 100,
      scaledQuantity: 200,
      baseQuantity: 200,
      name: 'Rijst',
    })
    expect(scaled.ingredients[1]).toMatchObject({ scaledQuantity: 2, baseQuantity: null })
    expect((await getRecipe(a, created.id)).ingredients[0]?.scaledQuantity).toBe(100)
    const large = await createRecipe(a, {
      ...input,
      servings: 1,
      ingredients: [{ ingredientId: input.ingredients[0]!.ingredientId, quantity: 1e9, unit: 'g' }],
    })
    expect((await getRecipe(a, large.id, 1000)).ingredients[0]?.baseQuantity).toBe(1e12)
    await expect(getRecipe(a, created.id, 0)).rejects.toBeInstanceOf(Invalid)
  })

  test('onbekende hoeveelheden en ingrediëntfactoren behouden hun betekenis', async () => {
    const { a, rice, input } = await setup()
    await setIngredientConversion(a, rice.id, { unit: 'pak', factor: 250 })
    const dish = await createRecipe(a, {
      ...input,
      ingredients: [
        { ingredientId: rice.id, quantity: 2, unit: 'pak' },
        { ingredientId: rice.id, quantity: null, unit: 'g', note: 'naar smaak' },
      ],
    })
    expect(dish.ingredients[0]?.baseQuantity).toBe(500)
    expect(dish.ingredients[1]).toMatchObject({
      quantity: null,
      scaledQuantity: null,
      baseQuantity: null,
      note: 'naar smaak',
    })
  })

  test('zoeken op naam, kleine schrijffouten en tags; archiveren behoudt gegevens', async () => {
    const { a, input } = await setup()
    const dish = await createRecipe(a, input)
    expect((await searchRecipes(a, { query: 'VEGETARISCH' })).map((row) => row.id)).toContain(dish.id)
    expect((await searchRecipes(a, { query: 'rijstgrecht' })).map((row) => row.id)).toContain(dish.id)
    await setRecipeArchived(a, dish.id, true)
    expect(await searchRecipes(a)).toEqual([])
    expect((await getRecipe(a, dish.id)).ingredients).toHaveLength(2)
    expect((await searchRecipes(a, { includeArchived: true })).map((row) => row.id)).toContain(dish.id)
    await setRecipeArchived(a, dish.id, false)
    expect((await searchRecipes(a)).map((row) => row.id)).toContain(dish.id)
  })

  test('de database bewaakt positieve porties, ook buiten de domeinadapter', async () => {
    const { a } = await setup()
    let failure: unknown
    try {
      await db
        .insert(recipe)
        .values({ householdId: a.household.id, name: 'Ongeldig', normalizedName: 'ongeldig', servings: 0 })
    } catch (error) {
      failure = error
    }
    expect(failure).toMatchObject({ cause: { code: '23514' } })
  })
})

describe('atomaire wijzigingen en afscherming', () => {
  test('onzichtbare recepten en ingrediënten worden niet gelekt of gewijzigd', async () => {
    const { a, b, input } = await setup()
    const dish = await createRecipe(a, input)
    b.user.role = 'admin'
    expect(await searchRecipes(b)).toEqual([])
    await expect(getRecipe(b, dish.id)).rejects.toBeInstanceOf(NotFound)
    await expect(
      updateRecipe(b, dish.id, { ...input, version: 1, name: 'Overgenomen' }),
    ).rejects.toBeInstanceOf(NotFound)
    await expect(setRecipeArchived(b, dish.id, true)).rejects.toBeInstanceOf(NotFound)
    await expect(createRecipe(b, input)).rejects.toBeInstanceOf(NotFound)
    expect((await getRecipe(a, dish.id)).name).toBe('Rijstgerecht')
    expect(await searchRecipes(b)).toEqual([])
  })

  test('ongeldige ingrediënten en instructies laten geen gedeeltelijke wijziging achter', async () => {
    const { a, input } = await setup()
    const dish = await createRecipe(a, input)
    await expect(
      updateRecipe(a, dish.id, {
        ...input,
        version: 1,
        name: 'Niet bewaren',
        ingredients: [{ ingredientId: 'bestaat-niet', quantity: 1, unit: 'g' }],
      }),
    ).rejects.toBeInstanceOf(NotFound)
    await expect(
      createRecipe(a, {
        ...input,
        name: 'Niet maken',
        sections: [{ id: 'cooking', openUi: 'root = Ingredients([])' }],
      }),
    ).rejects.toBeInstanceOf(Invalid)
    expect(await getRecipe(a, dish.id)).toMatchObject({ name: 'Rijstgerecht', version: 1 })
    expect((await getRecipe(a, dish.id)).ingredients).toHaveLength(2)
    expect(await searchRecipes(a, { query: 'Niet maken' })).toEqual([])
  })

  test('twee gelijktijdige editors: precies één complete versie wordt bewaard', async () => {
    const { a, rice, input } = await setup()
    const dish = await createRecipe(a, input)
    const outcomes = await Promise.allSettled([
      updateRecipe(a, dish.id, {
        ...input,
        version: 1,
        name: 'Wijziging A',
        ingredients: [{ ingredientId: rice.id, quantity: 11, unit: 'g' }],
      }),
      updateRecipe(a, dish.id, {
        ...input,
        version: 1,
        name: 'Wijziging B',
        ingredients: [{ ingredientId: rice.id, quantity: 12, unit: 'g' }],
      }),
    ])
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
    const rejected = outcomes.find((outcome) => outcome.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(Conflict)
    const saved = await getRecipe(a, dish.id)
    expect(saved.version).toBe(2)
    expect(saved.ingredients).toHaveLength(1)
    expect(saved.ingredients[0]?.quantity).toBe(saved.name === 'Wijziging A' ? 11 : 12)
  })

  test('bestaande gearchiveerde ingrediënten blijven leesbaar, maar worden niet nieuw toegevoegd', async () => {
    const { a, rice, salt, input } = await setup()
    const dish = await createRecipe(a, {
      ...input,
      ingredients: [{ ingredientId: rice.id, quantity: 100, unit: 'g' }],
    })
    await setIngredientArchived(a, rice.id, true)
    expect((await getRecipe(a, dish.id)).ingredients[0]?.archived).toBe(true)
    await expect(
      createRecipe(a, { ...input, ingredients: [{ ingredientId: rice.id, quantity: 1, unit: 'g' }] }),
    ).rejects.toBeInstanceOf(Invalid)
    expect(
      (
        await updateRecipe(a, dish.id, {
          ...input,
          version: 1,
          ingredients: [{ ingredientId: rice.id, quantity: 120, unit: 'g' }],
        })
      ).version,
    ).toBe(2)
    await setIngredientArchived(a, salt.id, true)
    await expect(updateRecipe(a, dish.id, { ...input, version: 2 })).rejects.toBeInstanceOf(Invalid)
    expect((await getRecipe(a, dish.id)).ingredients[0]?.quantity).toBe(120)
  })

  test.each(['javascript:alert(1)', 'file:///tmp/foto', 'data:image/png;base64,test'])(
    'weigert onveilige foto- en bronprotocollen: %s',
    async (url) => {
      const { a, input } = await setup()
      await expect(createRecipe(a, { ...input, photoUrl: url })).rejects.toBeInstanceOf(Invalid)
      await expect(createRecipe(a, { ...input, sourceUrl: url })).rejects.toBeInstanceOf(Invalid)
      expect(await db.select().from(recipe).where(eq(recipe.householdId, a.household.id))).toEqual([])
    },
  )
})

describe('eigen kopie van de gerechtfoto', () => {
  const png = (seed: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, seed])
  function fakeImages(responses: Record<string, Uint8Array | Error>) {
    const calls: { url: string; referer?: string }[] = []
    const fetchImage: FetchImage = async (url, options) => {
      calls.push({ url, referer: options?.referer })
      const response = responses[url]
      if (!response) throw new Invalid('De pagina gaf status 404.')
      if (response instanceof Error) throw response
      return { bytes: response, finalUrl: url }
    }
    return { calls, deps: { fetchImage } }
  }
  const householdImages = (householdId: string) =>
    db.select({ id: image.id }).from(image).where(eq(image.householdId, householdId))

  test('downloadt bij opslaan, bewaart de bron en levert alleen aan leden', async () => {
    const { a, b, input } = await setup()
    const { calls, deps } = fakeImages({ 'https://cdn.example.com/rijst.png': png(1) })
    const created = await createRecipe(
      a,
      { ...input, sourceUrl: 'https://example.com/rijst', photoUrl: 'https://cdn.example.com/rijst.png' },
      deps,
    )
    expect(created).not.toHaveProperty('photoWarning')
    expect(created.photoUrl).toBe('https://cdn.example.com/rijst.png')
    expect(created.imageUrl).toMatch(/^\/afbeeldingen\//)
    expect(calls).toEqual([
      { url: 'https://cdn.example.com/rijst.png', referer: 'https://example.com/rijst' },
    ])
    const imageId = decodeURIComponent(created.imageUrl!.split('/').pop()!)
    const stored = await getImageForUser(db, a.user.id, imageId)
    expect(stored?.contentType).toBe('image/png')
    expect([...stored!.bytes]).toEqual([...png(1)])
    expect(await getImageForUser(db, b.user.id, imageId)).toBeNull()
    expect((await searchRecipes(a, { query: 'rijst' }))[0]?.imageUrl).toBe(created.imageUrl)
  })

  test('alleen een gewijzigde URL wordt opnieuw gedownload; vervangen en wissen ruimen op', async () => {
    const { a, input } = await setup()
    const { calls, deps } = fakeImages({
      'https://cdn.example.com/een.png': png(1),
      'https://cdn.example.com/twee.png': png(2),
    })
    const created = await createRecipe(a, { ...input, photoUrl: 'https://cdn.example.com/een.png' }, deps)
    const same = await updateRecipe(
      a,
      created.id,
      { ...input, name: 'Rijst anders', photoUrl: 'https://cdn.example.com/een.png', version: 1 },
      deps,
    )
    expect(same.imageUrl).toBe(created.imageUrl)
    expect(calls).toHaveLength(1)
    const replaced = await updateRecipe(
      a,
      created.id,
      { ...input, photoUrl: 'https://cdn.example.com/twee.png', version: 2 },
      deps,
    )
    expect(replaced.imageUrl).not.toBe(created.imageUrl)
    expect(await householdImages(a.household.id)).toHaveLength(1)
    const cleared = await updateRecipe(a, created.id, { ...input, photoUrl: null, version: 3 }, deps)
    expect(cleared.imageUrl).toBeNull()
    expect(await householdImages(a.household.id)).toEqual([])
  })

  test('een mislukte of ongeldige download slaat het gerecht toch op, met waarschuwing', async () => {
    const { a, input } = await setup()
    const { deps } = fakeImages({ 'https://example.com/pagina.html': new TextEncoder().encode('<html>') })
    const missing = await createRecipe(a, { ...input, photoUrl: 'https://cdn.example.com/weg.png' }, deps)
    expect(missing).toMatchObject({ imageUrl: 'https://cdn.example.com/weg.png' })
    expect('photoWarning' in missing && missing.photoWarning).toContain('404')
    const html = await createRecipe(a, { ...input, photoUrl: 'https://example.com/pagina.html' }, deps)
    expect('photoWarning' in html && html.photoWarning).toContain('JPEG')
    expect(await householdImages(a.household.id)).toEqual([])
  })

  test('een gelijktijdige wijziging laat geen losse afbeelding achter', async () => {
    const { a, input } = await setup()
    const { deps } = fakeImages({ 'https://cdn.example.com/een.png': png(1) })
    const created = await createRecipe(a, input)
    await updateRecipe(a, created.id, { ...input, name: 'Eerst', version: 1 })
    await expect(
      updateRecipe(
        a,
        created.id,
        { ...input, photoUrl: 'https://cdn.example.com/een.png', version: 1 },
        deps,
      ),
    ).rejects.toBeInstanceOf(Conflict)
    expect(await householdImages(a.household.id)).toEqual([])
  })

  test('sniffImageType herkent alleen veilige afbeeldingstypen', () => {
    const bytes = (text: string) => new Uint8Array([...text].map((char) => char.charCodeAt(0)))
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(bytes('GIF89a...'))).toBe('image/gif')
    expect(sniffImageType(bytes('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffImageType(bytes('\0\0\0\x1cftypavif'))).toBe('image/avif')
    expect(sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull()
  })

  test('vindt een eerder geïmporteerd gerecht op bron, alleen in het eigen huishouden', async () => {
    const { a, b, input } = await setup()
    const created = await createRecipe(a, { ...input, sourceUrl: 'https://example.com/rijst' })
    await setRecipeArchived(a, created.id, true)
    expect(
      await findRecipeBySourceUrl(a, ['https://example.com/anders', 'https://example.com/rijst']),
    ).toEqual({
      id: created.id,
      name: 'Rijstgerecht',
      archived: true,
    })
    expect(await findRecipeBySourceUrl(b, ['https://example.com/rijst'])).toBeNull()
  })
})
