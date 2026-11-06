import { eq } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { householdPreferences, pantryItem, pantryMovement } from '~/db/schema'
import { setupTestDb } from '../../tests/db'
import { addMember, twoHouseholds } from '../../tests/fixtures'
import { createIngredient, setIngredientArchived, setIngredientConversion } from './catalog'
import { Conflict, Invalid, NotFound, resolveCtx } from './core'
import { getPantryHistory, getPantryItem, listPantry, removePantryItem, setPantryItem } from './pantry'
import { getHouseholdPreferences, setHouseholdPreferences } from './preferences'
import { createRecipe, getRecipe, getRecipeForHousehold } from './recipes'

const db = setupTestDb()
async function setup() {
  const { a, b } = await twoHouseholds(db)
  const rice = await createIngredient(a, { name: 'Rijst', baseUnit: 'g', aliases: ['rijstkorrels'] })
  return {
    a,
    b,
    rice,
    input: { ingredientId: rice.id, quantity: 1.5, unit: 'kg' as const, staple: false, version: 0 },
  }
}

describe('voorraad en basisvoorraad', () => {
  test('slaat exacte basishoeveelheden op, houdt basisvoorraad onafhankelijk en bewaart historie', async () => {
    const { a, rice, input } = await setup()
    expect(await getPantryItem(a, rice.id)).toMatchObject({ quantity: 0, staple: false, version: 0 })
    const first = await setPantryItem(a, { ...input, note: 'Telling na boodschappen' })
    expect(first).toMatchObject({ quantity: 1500, baseUnit: 'g', version: 1, staple: false })
    expect((await listPantry(a, { query: 'rijstkorrels' })).map((row) => row.ingredientId)).toContain(rice.id)
    await setPantryItem(a, {
      ...input,
      quantity: 1500,
      unit: 'g',
      staple: true,
      version: 1,
      reason: 'correction',
      note: 'Altijd in huis',
    })
    expect(await getPantryHistory(a, rice.id)).toEqual([
      expect.objectContaining({
        kind: 'correction',
        actorName: 'Anna',
        previousQuantity: 1500,
        quantity: 1500,
        previousStaple: false,
        staple: true,
      }),
      expect.objectContaining({
        kind: 'count',
        note: 'Telling na boodschappen',
        previousQuantity: 0,
        quantity: 1500,
      }),
    ])
    const removed = await removePantryItem(a, { ingredientId: rice.id, version: 2 })
    expect(removed).toMatchObject({ quantity: 0, staple: false, version: 3 })
    expect(await listPantry(a)).toEqual([])
    expect(await listPantry(a, { includeEmpty: true })).toHaveLength(1)
    expect((await getPantryHistory(a, rice.id))[0]).toMatchObject({
      kind: 'removed',
      previousQuantity: 1500,
      quantity: 0,
    })
    await setPantryItem(a, { ...input, quantity: 0, unit: 'g', staple: true, version: 3 })
    expect(await listPantry(a)).toEqual([expect.objectContaining({ quantity: 0, staple: true })])
  })

  test('bekende ingrediëntomrekening werkt; onbekende en vage eenheden muteren niets', async () => {
    const { a, rice, input } = await setup()
    await setIngredientConversion(a, rice.id, { unit: 'pak', factor: 250 })
    expect(await setPantryItem(a, { ...input, quantity: 2, unit: 'pak' })).toMatchObject({ quantity: 500 })
    for (const unit of ['blik', 'snuf', 'handje', 'scheut'] as const) {
      await expect(setPantryItem(a, { ...input, version: 1, unit })).rejects.toBeInstanceOf(Invalid)
    }
    expect(await getPantryHistory(a, rice.id)).toHaveLength(1)
    expect(await getPantryItem(a, rice.id)).toMatchObject({ quantity: 500, version: 1 })
    expect(await setPantryItem(a, { ...input, version: 1, quantity: 1e9, unit: 'kg' })).toMatchObject({
      quantity: 1e12,
    })
    expect(await setPantryItem(a, { ...input, version: 2, quantity: 1e12, unit: 'g' })).toMatchObject({
      quantity: 1e12,
    })
  })

  test('weigert ongeldige aantallen en laat de voorraad en historie intact', async () => {
    const { a, rice, input } = await setup()
    for (const quantity of [-1, NaN, Infinity, 1e12 + 1])
      await expect(setPantryItem(a, { ...input, quantity })).rejects.toBeInstanceOf(Invalid)
    expect(await getPantryHistory(a, rice.id)).toEqual([])
    expect(await getPantryItem(a, rice.id)).toMatchObject({ version: 0 })
  })

  test('een gelijktijdige eerste telling en correctie leveren elk één winnaar en één mutatie op', async () => {
    const { a, rice, input } = await setup()
    for (const version of [0, 1]) {
      const attempts = await Promise.allSettled([
        setPantryItem(a, { ...input, version, quantity: 2 }),
        setPantryItem(a, { ...input, version, quantity: 3 }),
      ])
      expect(attempts.filter((row) => row.status === 'fulfilled')).toHaveLength(1)
      const rejected = attempts.find((row) => row.status === 'rejected')
      expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(Conflict)
      expect(await getPantryHistory(a, rice.id)).toHaveLength(version + 1)
    }
    await expect(removePantryItem(a, { ingredientId: rice.id, version: 1 })).rejects.toBeInstanceOf(Conflict)
    expect((await getPantryItem(a, rice.id)).version).toBe(2)
  })

  test('huishoudens kunnen geen privévoorraad uitlezen of veranderen, ook niet als admin', async () => {
    const { a, b, rice, input } = await setup()
    await setPantryItem(a, input)
    b.user.role = 'admin'
    await Promise.all(
      [
        getPantryItem(b, rice.id),
        getPantryHistory(b, rice.id),
        setPantryItem(b, { ...input, version: 1 }),
        removePantryItem(b, { ingredientId: rice.id, version: 1 }),
      ].map((action) => expect(action).rejects.toBeInstanceOf(NotFound)),
    )
    expect(await listPantry(b)).toEqual([])
    a.user.role = 'admin'
    const global = await createIngredient(a, {
      name: `Globale rijst ${crypto.randomUUID()}`,
      baseUnit: 'g',
      scope: 'global',
    })
    await setPantryItem(a, { ...input, ingredientId: global.id })
    expect(await getPantryItem(b, global.id)).toMatchObject({ quantity: 0, version: 0 })
    expect(await getPantryHistory(b, global.id)).toEqual([])
    await setPantryItem(b, { ...input, ingredientId: global.id, quantity: 2 })
    expect(await getPantryItem(a, global.id)).toMatchObject({ quantity: 1500, version: 1 })
  })

  test('gearchiveerde ingrediënten behouden bestaande voorraad en correcties, maar geen nieuwe regel', async () => {
    const { a, rice, input } = await setup()
    await setPantryItem(a, input)
    await setIngredientArchived(a, rice.id, true)
    expect(await listPantry(a)).toEqual([
      expect.objectContaining({ ingredientId: rice.id, archivedAt: expect.any(Date) }),
    ])
    expect(await setPantryItem(a, { ...input, version: 1, quantity: 1 })).toMatchObject({
      quantity: 1000,
      archived: true,
    })
    const empty = await createIngredient(a, { name: 'Oude pasta', baseUnit: 'g' })
    await setIngredientArchived(a, empty.id, true)
    await expect(setPantryItem(a, { ...input, ingredientId: empty.id })).rejects.toBeInstanceOf(Invalid)
  })

  test('databaseconstraints beschermen tegen negatieve, oneindige en dubbele voorraad', async () => {
    const { a, rice } = await setup()
    const row = { householdId: a.household.id, ingredientId: rice.id }
    for (const quantity of [-1, NaN, Infinity, 1e12 + 1])
      await expect(db.insert(pantryItem).values({ ...row, quantity })).rejects.toThrow()
    await expect(db.insert(pantryItem).values({ ...row, version: 0 })).rejects.toThrow()
    await db.insert(pantryItem).values(row)
    await expect(db.insert(pantryItem).values(row)).rejects.toThrow()
    await expect(db.insert(pantryItem).values({ ...row, ingredientId: 'onbekend' })).rejects.toThrow()
    await expect(
      db.insert(householdPreferences).values({ householdId: a.household.id, defaultServings: 0 }),
    ).rejects.toThrow()
    expect(
      await db.select().from(pantryMovement).where(eq(pantryMovement.householdId, a.household.id)),
    ).toEqual([])
  })
})

describe('huishoudvoorkeuren', () => {
  test('leden delen standaardporties; recept en expliciete porties blijven leidend voor hun eigen inhoud', async () => {
    const { a, b, rice } = await setup()
    expect(await getHouseholdPreferences(a)).toEqual({ defaultServings: 2 })
    const dish = await createRecipe(a, {
      name: 'Rijst voor zes',
      servings: 6,
      ingredients: [{ ingredientId: rice.id, quantity: 600, unit: 'g' }],
    })
    await setHouseholdPreferences(a, { defaultServings: 4 })
    expect(await getHouseholdPreferences(b)).toEqual({ defaultServings: 2 })
    await addMember(db, a.household.id, b.user.id, 'member')
    const member = await resolveCtx(db, b.user.id)
    // The existing active household remains B; explicitly resolve A for this shared membership check.
    const memberA = { ...member, household: { ...a.household, role: 'member' as const } }
    expect(await getHouseholdPreferences(memberA)).toEqual({ defaultServings: 4 })
    expect(await getRecipeForHousehold(a, dish.id)).toMatchObject({ servings: 6, viewServings: 4 })
    expect((await getRecipeForHousehold(a, dish.id)).ingredients[0]?.scaledQuantity).toBe(400)
    expect((await getRecipeForHousehold(a, dish.id, 3)).ingredients[0]?.scaledQuantity).toBe(300)
    expect((await getRecipe(a, dish.id)).ingredients[0]?.quantity).toBe(600)
    expect((await getRecipe(a, dish.id)).servings).toBe(6)
    await setHouseholdPreferences(memberA, { defaultServings: 3 })
    expect(await getHouseholdPreferences(a)).toEqual({ defaultServings: 3 })
    for (const defaultServings of [0, 1.5, 1001, NaN])
      await expect(setHouseholdPreferences(a, { defaultServings })).rejects.toBeInstanceOf(Invalid)
    expect(await getHouseholdPreferences(a)).toEqual({ defaultServings: 3 })
  })
})
