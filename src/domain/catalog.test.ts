import { describe, expect, test } from 'vitest'
import { setupTestDb } from '../../tests/db'
import { twoHouseholds } from '../../tests/fixtures'
import { Conflict, Forbidden, Invalid, NotFound } from './core'
import {
  convertIngredientAmount,
  createIngredient,
  getIngredient,
  removeIngredientConversion,
  searchIngredients,
  setIngredientArchived,
  setIngredientConversion,
  updateIngredient,
} from './catalog'

const db = setupTestDb()

describe('catalogus', () => {
  test('foto en bron behouden bij oude clients, expliciet wissen en bestaande rechten toepassen', async () => {
    const { a, b } = await twoHouseholds(db)
    const photo = {
      url: 'https://images.example.test/tomaat.png',
      sourceUrl: 'https://example.test/tomaat',
      credit: 'Voorbeeldfotograaf',
      licenseUrl: 'https://example.test/license',
    }
    const own = await createIngredient(a, { name: 'Fototomaat', baseUnit: 'g', photo })
    expect((await getIngredient(a, own.id)).photo).toEqual(photo)
    expect((await searchIngredients(a)).find((item) => item.id === own.id)?.photo).toEqual(photo)
    await updateIngredient(a, own.id, { name: 'Fototomaten', aliases: [] })
    expect((await getIngredient(a, own.id)).photo).toEqual(photo)
    await expect(updateIngredient(b, own.id, { name: 'Overnemen', photo: null })).rejects.toBeInstanceOf(
      NotFound,
    )
    await updateIngredient(a, own.id, { name: 'Fototomaten', photo: null })
    expect((await getIngredient(a, own.id)).photo).toBeNull()
    a.user.role = 'admin'
    const global = await createIngredient(a, {
      name: `Globale foto ${crypto.randomUUID()}`,
      baseUnit: 'g',
      scope: 'global',
      photo,
    })
    await expect(updateIngredient(b, global.id, { name: global.name, photo: null })).rejects.toBeInstanceOf(
      Forbidden,
    )
    expect((await getIngredient(b, global.id)).photo).toEqual(photo)
  })

  test.each([
    'geen-url',
    'javascript:alert(1)',
    'data:image/png;base64,AA==',
    'ftp://example.test/photo.png',
    'https://user:password@example.test/photo.png',
  ])('weigert ongeldige of ongewenste afbeeldings-URLs zonder gedeeltelijke wijziging: %s', async (url) => {
    const { a } = await twoHouseholds(db)
    const own = await createIngredient(a, { name: 'Beeldvalidatie', baseUnit: 'g' })
    await expect(
      updateIngredient(a, own.id, { name: 'Ongewenste wijziging', photo: { url } }),
    ).rejects.toBeInstanceOf(Invalid)
    expect(await getIngredient(a, own.id)).toMatchObject({ name: 'Beeldvalidatie', photo: null })
  })
  test('zichtbaarheid omvat globaal en eigen; ook een admin kan andere privégegevens niet benaderen', async () => {
    const { a, b } = await twoHouseholds(db)
    a.user.role = 'admin'
    const global = await createIngredient(a, {
      name: `Globaal ${crypto.randomUUID()}`,
      baseUnit: 'g',
      scope: 'global',
    })
    const own = await createIngredient(a, { name: 'Eigen receptmix', baseUnit: 'g' })
    const theirs = await createIngredient(b, { name: 'Geheim receptmengsel', baseUnit: 'g' })
    const visible = (await searchIngredients(a)).map((row) => row.id)
    expect(visible).toContain(global.id)
    expect(visible).toContain(own.id)
    expect(visible).not.toContain(theirs.id)
    expect((await getIngredient(b, global.id)).canManage).toBe(false)
    await expect(getIngredient(a, theirs.id)).rejects.toBeInstanceOf(NotFound)
    await expect(updateIngredient(a, theirs.id, { name: 'Overgenomen' })).rejects.toBeInstanceOf(NotFound)
    await expect(setIngredientArchived(a, theirs.id, true)).rejects.toBeInstanceOf(NotFound)
    expect((await getIngredient(b, theirs.id)).name).toBe('Geheim receptmengsel')
  })

  test('globaal beheer vereist admin; leden kunnen hun eigen ingrediënten beheren', async () => {
    const { a, b } = await twoHouseholds(db)
    await expect(
      createIngredient(b, { name: 'Globaal geweigerd', baseUnit: 'g', scope: 'global' }),
    ).rejects.toBeInstanceOf(Forbidden)
    a.user.role = 'admin'
    const global = await createIngredient(a, {
      name: `Beheerd ${crypto.randomUUID()}`,
      baseUnit: 'ml',
      scope: 'global',
    })
    await expect(updateIngredient(b, global.id, { name: 'Nieuwe naam' })).rejects.toBeInstanceOf(Forbidden)
    await expect(setIngredientArchived(b, global.id, true)).rejects.toBeInstanceOf(Forbidden)
    const own = await createIngredient(b, { name: 'Kruidenmix', baseUnit: 'g' })
    expect(await updateIngredient(b, own.id, { name: 'Mijn kruiden', aliases: ['mix'] })).toMatchObject({
      name: 'Mijn kruiden',
      aliases: ['mix'],
    })
  })

  test('zoekt op aliassen en schrijffouten en plaatst exacte treffers eerst', async () => {
    const { a } = await twoHouseholds(db)
    const tomato = await createIngredient(a, { name: 'Tomaat', aliases: ['Paradeiser'], baseUnit: 'g' })
    await createIngredient(a, { name: 'Tomatenpuree', baseUnit: 'g' })
    expect((await searchIngredients(a, { query: 'PARADEISER' })).map((row) => row.id)).toContain(tomato.id)
    expect((await searchIngredients(a, { query: 'tomat' })).map((row) => row.id)).toContain(tomato.id)
    expect((await searchIngredients(a, { query: 'tomaat' }))[0]?.id).toBe(tomato.id)
  })

  test('dubbele namen worden ook bij gelijktijdige aanmaak op databaseniveau voorkomen', async () => {
    const { a, b } = await twoHouseholds(db)
    const results = await Promise.allSettled([
      createIngredient(a, { name: 'Rode   Kool', baseUnit: 'g' }),
      createIngredient(a, { name: ' rode kool ', baseUnit: 'g' }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.find((result) => result.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(Conflict)
    await expect(createIngredient(b, { name: 'Rode kool', baseUnit: 'g' })).resolves.toMatchObject({
      name: 'Rode kool',
    })
  })

  test('archiveren verbergt de kandidaat, behoudt het ID en laat herstellen toe', async () => {
    const { a } = await twoHouseholds(db)
    const item = await createIngredient(a, { name: 'Tijdelijk ingrediënt', baseUnit: 'stuk' })
    await setIngredientArchived(a, item.id, true)
    expect((await searchIngredients(a)).map((row) => row.id)).not.toContain(item.id)
    expect((await getIngredient(a, item.id)).archivedAt).not.toBeNull()
    expect((await searchIngredients(a, { includeArchived: true })).map((row) => row.id)).toContain(item.id)
    await setIngredientArchived(a, item.id, false)
    expect((await searchIngredients(a)).map((row) => row.id)).toContain(item.id)
  })

  test('de domeinlaag valideert invoer en accepteert geen aanpassing van scope of basiseenheid', async () => {
    const { a } = await twoHouseholds(db)
    await expect(createIngredient(a, { name: ' ', baseUnit: 'g' })).rejects.toBeInstanceOf(Invalid)
    const item = await createIngredient(a, { name: 'Vast ingrediënt', baseUnit: 'g' })
    await expect(
      updateIngredient(a, item.id, { name: 'Vast', baseUnit: 'ml' } as never),
    ).rejects.toBeInstanceOf(Invalid)
    expect((await getIngredient(a, item.id)).baseUnit).toBe('g')
  })
})

describe('ingrediëntspecifieke omrekeningen', () => {
  test('toevoegen, vervangen, familieomrekening en verwijderen', async () => {
    const { a } = await twoHouseholds(db)
    const item = await createIngredient(a, { name: 'Olie', baseUnit: 'g' })
    expect(await convertIngredientAmount(a, item.id, 1, 'l')).toBeNull()
    await setIngredientConversion(a, item.id, { unit: 'l', factor: 900 })
    expect(await convertIngredientAmount(a, item.id, 1, 'l')).toBe(900)
    await setIngredientConversion(a, item.id, { unit: 'ml', factor: 0.8 })
    expect((await getIngredient(a, item.id)).conversions).toEqual([{ unit: 'ml', factor: 0.8 }])
    expect(await convertIngredientAmount(a, item.id, 1, 'l')).toBe(800)
    await removeIngredientConversion(a, item.id, 'l')
    expect(await convertIngredientAmount(a, item.id, 1, 'l')).toBeNull()
    await expect(setIngredientConversion(a, item.id, { unit: 'scheut', factor: 10 })).rejects.toBeInstanceOf(
      Invalid,
    )
    await expect(setIngredientConversion(a, item.id, { unit: 'blik', factor: -1 })).rejects.toBeInstanceOf(
      Invalid,
    )
  })

  test('omrekeningen van een ander huishouden zijn onzichtbaar en onwijzigbaar', async () => {
    const { a, b } = await twoHouseholds(db)
    const item = await createIngredient(a, { name: 'Tomatenblokjes', baseUnit: 'g' })
    await setIngredientConversion(a, item.id, { unit: 'blik', factor: 400 })
    await expect(convertIngredientAmount(b, item.id, 1, 'blik')).rejects.toBeInstanceOf(NotFound)
    await expect(setIngredientConversion(b, item.id, { unit: 'blik', factor: 1 })).rejects.toBeInstanceOf(
      NotFound,
    )
    await expect(removeIngredientConversion(b, item.id, 'blik')).rejects.toBeInstanceOf(NotFound)
    expect(await convertIngredientAmount(a, item.id, 2, 'blik')).toBe(800)
  })
})
