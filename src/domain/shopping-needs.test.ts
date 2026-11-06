import { describe, expect, test } from 'vitest'
import { setupTestDb } from '../../tests/db'
import { twoHouseholds } from '../../tests/fixtures'
import { createIngredient, updateIngredient } from './catalog'
import { NotFound } from './core'
import { prepareCooking, recordMade } from './cooking'
import { getPantryItem, setPantryItem } from './pantry'
import { createPlannedMeal, removePlannedMeal } from './planning'
import { setHouseholdPreferences } from './preferences'
import { createRecipe, setRecipeArchived } from './recipes'
import { calculateShoppingNeeds, prepareShopping } from './shopping-needs'

const db = setupTestDb()
async function setup() {
  const { a, b } = await twoHouseholds(db)
  const tomato = await createIngredient(a, { name: 'Tomaten', baseUnit: 'g' })
  const salt = await createIngredient(a, { name: 'Zout', baseUnit: 'g' })
  const beans = await createIngredient(a, { name: 'Bonen', baseUnit: 'g' })
  for (const [ingredientId, quantity, staple] of [
    [tomato.id, 200, false],
    [salt.id, 2, true],
    [beans.id, 50, false],
  ] as const)
    await setPantryItem(a, { ingredientId, quantity, staple, unit: 'g', version: 0 })
  const first = await createRecipe(a, {
    name: 'Tomaten met bonen',
    servings: 2,
    ingredients: [
      { ingredientId: tomato.id, quantity: 400, unit: 'g' },
      { ingredientId: salt.id, quantity: 1, unit: 'snuf' },
      { ingredientId: beans.id, quantity: 1, unit: 'blik' },
    ],
  })
  const second = await createRecipe(a, {
    name: 'Andere bonenschotel',
    servings: 2,
    ingredients: [
      { ingredientId: tomato.id, quantity: 300, unit: 'g' },
      { ingredientId: beans.id, quantity: 100, unit: 'g' },
    ],
  })
  return { a, b, tomato, salt, beans, first, second }
}

describe('boodschappenbehoefte', () => {
  test('foto’s volgen te kopen, basisvoorraad en voldoende voorraad zonder tekst of fingerprint te veranderen', async () => {
    const { a, tomato, salt, beans, first } = await setup()
    await setPantryItem(a, { ingredientId: tomato.id, quantity: 400, unit: 'g', staple: false, version: 1 })
    const source = { kind: 'recipe' as const, recipeId: first.id, servings: 2 }
    const before = await calculateShoppingNeeds(a, source)
    const photo = {
      url: 'https://images.example.test/ingredient.png',
      sourceUrl: null,
      credit: 'Testbron',
      licenseUrl: null,
    }
    for (const item of [tomato, salt, beans])
      await updateIngredient(a, item.id, { name: item.name, aliases: item.aliases, photo })
    const after = await calculateShoppingNeeds(a, source)
    expect(after.items.find((item) => item.ingredientId === beans.id)?.photo).toEqual(photo)
    expect(after.staples.find((item) => item.ingredientId === salt.id)?.photo).toEqual(photo)
    expect(after.covered.find((item) => item.ingredientId === tomato.id)?.photo).toEqual(photo)
    expect(after.fingerprint).toBe(before.fingerprint)
    expect(after.text).toBe(before.text)
    expect(after.lines).toEqual(before.lines)
    await updateIngredient(a, beans.id, { name: beans.name, aliases: [], photo: null })
    const removed = await calculateShoppingNeeds(a, source)
    expect(removed.items.find((item) => item.ingredientId === beans.id)?.photo).toBeNull()
    expect(removed.fingerprint).toBe(before.fingerprint)
  })
  test('schaalt porties, trekt voorraad af, sluit basisvoorraad uit en behoudt onbekende blikhoeveelheden', async () => {
    const { a, tomato, salt, beans, first } = await setup()
    const need = await calculateShoppingNeeds(a, { kind: 'recipe', recipeId: first.id, servings: 2 })
    expect(need.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ingredientId: tomato.id, required: 400, available: 200, needed: 200 }),
        expect.objectContaining({
          ingredientId: beans.id,
          required: 0,
          available: 50,
          needed: 0,
          unknown: [expect.objectContaining({ quantity: 1, unit: 'blik', reason: 'omrekening onbekend' })],
        }),
      ]),
    )
    expect(need.staples).toEqual([expect.objectContaining({ ingredientId: salt.id, needed: 0 })])
    expect(need.lines).toContain('200 g · Tomaten')
    expect(need.lines.some((line) => line.includes('1 blik') && line.includes('omrekening onbekend'))).toBe(
      true,
    )
    expect(need.lines.some((line) => line.includes('Zout'))).toBe(false)
    expect(need.text).toContain('Basisvoorraad (niet toegevoegd): Zout')
    const smaller = await calculateShoppingNeeds(a, { kind: 'recipe', recipeId: first.id, servings: 1 })
    expect(smaller.covered).toEqual([expect.objectContaining({ ingredientId: tomato.id, needed: 0 })])
    expect((await getPantryItem(a, tomato.id)).quantity).toBe(200)
  })

  test('dag/week aggregeert gedeelde ingrediënten en trekt voorraad slechts eenmaal af, ook met een onbekend deel', async () => {
    const { a, tomato, beans, first, second } = await setup()
    const meal = await createPlannedMeal(a, { kind: 'recipe', recipeId: first.id, date: '2027-01-04' })
    await createPlannedMeal(a, { kind: 'recipe', recipeId: second.id, date: '2027-01-04' })
    const day = await calculateShoppingNeeds(a, { kind: 'day', date: '2027-01-04' })
    expect(day.items.find((item) => item.ingredientId === tomato.id)).toMatchObject({
      required: 700,
      available: 200,
      needed: 500,
    })
    expect(day.items.find((item) => item.ingredientId === beans.id)).toMatchObject({
      required: 100,
      needed: 50,
      unknown: [expect.objectContaining({ quantity: 1, unit: 'blik' })],
    })
    const week = await calculateShoppingNeeds(a, { kind: 'week', date: '2027-01-07' })
    expect(week.source).toEqual({ kind: 'week', date: '2027-01-04' })
    expect(week.items).toEqual(day.items)
    expect(week.sourceKeys).toContain(`planned:${meal.id}`)
    expect(week.sourceKeys).toEqual(day.sourceKeys)
  })

  test('vrije, verwijderde en reeds gemaakte geplande items tellen niet opnieuw mee, met zichtbare redenen', async () => {
    const { a, first, second } = await setup()
    const free = await createPlannedMeal(a, { kind: 'free', title: 'Restjes', date: '2027-01-04' })
    const removed = await createPlannedMeal(a, { kind: 'recipe', recipeId: first.id, date: '2027-01-04' })
    await removePlannedMeal(a, removed.id, 1)
    const made = await createPlannedMeal(a, { kind: 'recipe', recipeId: first.id, date: '2027-01-04' })
    const prep = await prepareCooking(a, { recipeId: first.id, plannedMealId: made.id })
    await recordMade(a, {
      requestId: prep.requestId,
      recipeId: prep.recipeId,
      recipeVersion: prep.recipeVersion,
      plannedMealId: prep.plannedMealId,
      plannedMealVersion: prep.plannedMealVersion,
      servings: prep.servings,
      date: prep.date,
      deductions: [],
    })
    const active = await createPlannedMeal(a, { kind: 'recipe', recipeId: second.id, date: '2027-01-04' })
    const day = await calculateShoppingNeeds(a, { kind: 'day', date: '2027-01-04' })
    expect(day.sourceKeys).toEqual([`planned:${active.id}`])
    expect(day.ignored).toEqual(
      expect.arrayContaining([
        { id: free.id, title: 'Restjes', reason: 'free' },
        { id: made.id, title: first.name, reason: 'made' },
      ]),
    )
    expect(day.ignored.some((item) => item.id === removed.id)).toBe(false)
    expect(
      (await calculateShoppingNeeds(a, { kind: 'recipe', recipeId: first.id })).items.length,
    ).toBeGreaterThan(0)
  })

  test('gearchiveerde recepten in bestaande planning blijven berekenbaar', async () => {
    const { a, first } = await setup()
    const meal = await createPlannedMeal(a, {
      kind: 'recipe',
      recipeId: first.id,
      date: '2027-01-04',
      servings: 3,
    })
    await setRecipeArchived(a, first.id, true)
    const need = await calculateShoppingNeeds(a, { kind: 'day', date: '2027-01-04' })
    expect(need.sourceKeys).toContain(`planned:${meal.id}`)
    expect(need.sources[0]?.servings).toBe(3)
  })

  test('voorstellen hebben een stabiele inhoudsfingerprint en nieuwe verzoeksleutel; relevante telling verandert de fingerprint', async () => {
    const { a, tomato, first } = await setup()
    const source = { kind: 'recipe' as const, recipeId: first.id, servings: 2 }
    const one = await prepareShopping(a, source),
      two = await prepareShopping(a, source)
    expect(one.fingerprint).toBe(two.fingerprint)
    expect(one.requestId).not.toBe(two.requestId)
    await setPantryItem(a, { ingredientId: tomato.id, quantity: 100, unit: 'g', staple: false, version: 1 })
    expect((await prepareShopping(a, source)).fingerprint).not.toBe(one.fingerprint)
    await setHouseholdPreferences(a, { defaultServings: 4 })
    expect((await calculateShoppingNeeds(a, { kind: 'recipe', recipeId: first.id })).source).toEqual({
      kind: 'recipe',
      recipeId: first.id,
      servings: 4,
    })
  })

  test('andere huishoudens kunnen geen receptbron gebruiken en zien geen planningitems', async () => {
    const { a, b, first } = await setup()
    await createPlannedMeal(a, { kind: 'recipe', recipeId: first.id, date: '2027-01-04' })
    b.user.role = 'admin'
    await expect(calculateShoppingNeeds(b, { kind: 'recipe', recipeId: first.id })).rejects.toBeInstanceOf(
      NotFound,
    )
    expect((await calculateShoppingNeeds(b, { kind: 'week', date: '2027-01-04' })).items).toEqual([])
  })
})
