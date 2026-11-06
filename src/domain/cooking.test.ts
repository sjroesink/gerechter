import { eq } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { madeDeduction, madeEvent, madeRating, pantryMovement } from '~/db/schema'
import { setupTestDb } from '../../tests/db'
import { addMember, twoHouseholds } from '../../tests/fixtures'
import { createIngredient } from './catalog'
import { Conflict, Invalid, NotFound } from './core'
import {
  getMadeEvent,
  getRecipeStats,
  prepareCooking,
  recordMade,
  searchCookingHistory,
  setMyMadeRating,
  type CookingPreparation,
} from './cooking'
import { getPantryHistory, getPantryItem, setPantryItem } from './pantry'
import { createPlannedMeal, removePlannedMeal, updatePlannedMeal } from './planning'
import { createRecipe, setRecipeArchived, updateRecipe } from './recipes'

const db = setupTestDb()
async function setup() {
  const { a, b } = await twoHouseholds(db)
  const rice = await createIngredient(a, { name: 'Rijst', baseUnit: 'g' })
  const salt = await createIngredient(a, { name: 'Zout', baseUnit: 'g' })
  const beans = await createIngredient(a, { name: 'Bonen', baseUnit: 'g' })
  for (const [ingredientId, quantity] of [
    [rice.id, 1000],
    [salt.id, 50],
    [beans.id, 400],
  ] as const)
    await setPantryItem(a, {
      ingredientId,
      quantity,
      unit: 'g',
      staple: ingredientId === salt.id,
      version: 0,
    })
  const input = {
    name: 'Rijstschotel',
    servings: 2,
    ingredients: [
      { ingredientId: rice.id, quantity: 100, unit: 'g' as const },
      { ingredientId: rice.id, quantity: 50, unit: 'g' as const },
      { ingredientId: salt.id, quantity: 1, unit: 'snuf' as const },
      { ingredientId: beans.id, quantity: 1, unit: 'blik' as const },
    ],
    sections: [{ id: 'cooking' as const, text: 'Kook en meng.', openUi: '' }],
  }
  const recipe = await createRecipe(a, input)
  const prep = await prepareCooking(a, { recipeId: recipe.id })
  return { a, b, rice, salt, beans, recipe, prep, input }
}
function confirmation(prep: CookingPreparation) {
  return {
    requestId: prep.requestId,
    recipeId: prep.recipeId,
    recipeVersion: prep.recipeVersion,
    plannedMealId: prep.plannedMealId,
    plannedMealVersion: prep.plannedMealVersion,
    servings: prep.servings,
    date: prep.date,
    deductions: prep.deductions.map((line) => ({
      ingredientId: line.ingredientId,
      quantity: line.proposed,
      pantryVersion: line.pantryVersion,
    })),
  }
}

describe('gemaakt registreren en voorraad afboeken', () => {
  test('voegt dubbele ingrediënten samen en raadt bij vage of ontbrekende conversies geen afboeking', async () => {
    const { prep, rice, salt, beans } = await setup()
    expect(prep.deductions).toHaveLength(3)
    expect(prep.deductions.find((line) => line.ingredientId === rice.id)).toMatchObject({
      required: 150,
      proposed: 150,
      available: 1000,
      pantryVersion: 1,
    })
    for (const ingredientId of [salt.id, beans.id])
      expect(prep.deductions.find((line) => line.ingredientId === ingredientId)).toMatchObject({
        required: null,
        proposed: 0,
        explanation: expect.any(String),
      })
    expect(prep.deductions.find((line) => line.ingredientId === salt.id)?.staple).toBe(true)
  })

  test('bewaart een aangepast exact gebruik en eigen cijfer met herleidbare voorraadmutaties', async () => {
    const { a, prep, rice, salt } = await setup()
    const input = confirmation(prep)
    input.deductions.find((line) => line.ingredientId === rice.id)!.quantity = 120
    input.deductions.find((line) => line.ingredientId === salt.id)!.quantity = 1
    const event = await recordMade(a, { ...input, rating: { score: 8, note: 'Lekker, iets minder zout.' } })
    expect(event).toMatchObject({
      servings: 2,
      actorName: 'Anna',
      snapshot: { name: 'Rijstschotel', servings: 2 },
      ratings: [expect.objectContaining({ score: 8, isMe: true })],
    })
    expect(event.deductions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ingredientId: rice.id,
          quantity: 120,
          previousQuantity: 1000,
          remainingQuantity: 880,
        }),
        expect.objectContaining({ ingredientId: salt.id, quantity: 1, remainingQuantity: 49 }),
      ]),
    )
    expect(await getPantryItem(a, rice.id)).toMatchObject({ quantity: 880, version: 2 })
    expect(await getPantryItem(a, salt.id)).toMatchObject({ quantity: 49, staple: true, version: 2 })
    expect((await getPantryHistory(a, rice.id))[0]).toMatchObject({
      kind: 'cooked',
      note: 'Gemaakt: Rijstschotel',
      quantity: 880,
    })
    expect((await searchCookingHistory(a, { query: 'rijst' })).map((item) => item.id)).toContain(event.id)
  })

  test('gelijktijdig of later herhalen van dezelfde bevestiging boekt maar eenmaal af', async () => {
    const { a, prep, rice } = await setup()
    const input = confirmation(prep)
    const events = await Promise.all([recordMade(a, input), recordMade(a, input)])
    expect(events[0].id).toBe(events[1].id)
    expect((await recordMade(a, input)).id).toBe(events[0].id)
    expect(await searchCookingHistory(a)).toHaveLength(1)
    expect(await getPantryItem(a, rice.id)).toMatchObject({ quantity: 850, version: 2 })
    expect(await getPantryHistory(a, rice.id)).toHaveLength(2)
    await expect(recordMade(a, { ...input, servings: 3 })).rejects.toBeInstanceOf(Conflict)
    expect((await getPantryItem(a, rice.id)).quantity).toBe(850)
  })

  test('een latere fout rolt event, eerdere afboekingen, audit en beoordeling volledig terug', async () => {
    const { a, prep } = await setup()
    const input = confirmation(prep)
    input.deductions.sort((x, y) => x.ingredientId.localeCompare(y.ingredientId))
    input.deductions.forEach((line) => {
      line.quantity = 1
    })
    input.deductions.at(-1)!.quantity = 1e12
    await expect(recordMade(a, { ...input, rating: { score: 8 } })).rejects.toBeInstanceOf(Invalid)
    expect(await searchCookingHistory(a)).toEqual([])
    for (const line of prep.deductions) {
      expect(await getPantryItem(a, line.ingredientId)).toMatchObject({
        quantity: line.available,
        version: 1,
      })
      expect(await getPantryHistory(a, line.ingredientId)).toHaveLength(1)
    }
    expect(await db.select().from(madeRating).where(eq(madeRating.householdId, a.household.id))).toEqual([])
  })

  test('verouderde recept-, planning- en voorraadversies geven een conflict zonder gedeeltelijke registratie', async () => {
    const { a, recipe, prep, rice } = await setup()
    await setPantryItem(a, { ingredientId: rice.id, quantity: 1000, unit: 'g', staple: false, version: 1 })
    await expect(recordMade(a, confirmation(prep))).rejects.toBeInstanceOf(Conflict)
    const plan = await createPlannedMeal(a, {
      date: '2027-01-04',
      kind: 'recipe',
      recipeId: recipe.id,
      servings: 3,
    })
    const planned = await prepareCooking(a, { recipeId: recipe.id, plannedMealId: plan.id })
    expect(planned.servings).toBe(3)
    await updatePlannedMeal(a, plan.id, {
      date: plan.date,
      kind: 'recipe',
      recipeId: recipe.id,
      servings: 2,
      version: 1,
    })
    await expect(recordMade(a, confirmation(planned))).rejects.toBeInstanceOf(Conflict)
    const current = await prepareCooking(a, { recipeId: recipe.id })
    await setRecipeArchived(a, recipe.id, true)
    await expect(recordMade(a, confirmation(current))).rejects.toBeInstanceOf(Conflict)
    expect(await searchCookingHistory(a)).toEqual([])
    expect((await getPantryItem(a, rice.id)).quantity).toBe(1000)
  })

  test('twee verschillende bevestigingen met dezelfde voorraadversie hebben één winnaar', async () => {
    const { a, recipe, prep, rice } = await setup()
    const other = await prepareCooking(a, { recipeId: recipe.id })
    const attempts = await Promise.allSettled([
      recordMade(a, confirmation(prep)),
      recordMade(a, confirmation(other)),
    ])
    expect(attempts.filter((row) => row.status === 'fulfilled')).toHaveLength(1)
    const rejected = attempts.find((row) => row.status === 'rejected')
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(Conflict)
    expect(await searchCookingHistory(a)).toHaveLength(1)
    expect((await getPantryItem(a, rice.id)).quantity).toBe(850)
  })

  test('dubbele en niet-receptingrediënten, negatieve hoeveelheden en ongeldige cijfers worden geweigerd', async () => {
    const { a, prep } = await setup()
    const input = confirmation(prep)
    await expect(
      recordMade(a, { ...input, deductions: [...input.deductions, input.deductions[0]!] }),
    ).rejects.toBeInstanceOf(Invalid)
    const unrelated = await createIngredient(a, { name: 'Buiten het gerecht', baseUnit: 'g' })
    await expect(
      recordMade(a, {
        ...input,
        deductions: [{ ingredientId: unrelated.id, quantity: 1, pantryVersion: 0 }],
      }),
    ).rejects.toBeInstanceOf(Invalid)
    for (const quantity of [-1, NaN, Infinity])
      await expect(
        recordMade(a, { ...input, deductions: [{ ...input.deductions[0]!, quantity }] }),
      ).rejects.toBeInstanceOf(Invalid)
    for (const score of [0, 1.5, 11])
      await expect(recordMade(a, { ...input, rating: { score } })).rejects.toBeInstanceOf(Invalid)
    expect(await searchCookingHistory(a)).toEqual([])
  })
})

describe('geschiedenis en persoonlijke beoordelingen', () => {
  test('momentopname blijft gelijk na receptwijzigingen, archivering en verwijderen uit planning', async () => {
    const { a, recipe, input } = await setup()
    const plan = await createPlannedMeal(a, { date: '2027-01-04', kind: 'recipe', recipeId: recipe.id })
    const prep = await prepareCooking(a, { recipeId: recipe.id, plannedMealId: plan.id })
    const event = await recordMade(a, confirmation(prep))
    await updateRecipe(a, recipe.id, { ...input, name: 'Nieuwe naam', version: 1, sections: [] })
    await setRecipeArchived(a, recipe.id, true)
    await removePlannedMeal(a, plan.id, 1)
    const read = await getMadeEvent(a, event.id)
    expect(read.snapshot).toEqual(event.snapshot)
    expect(read.snapshot.name).toBe('Rijstschotel')
    expect(read.snapshot.sections[0]?.text).toBe('Kook en meng.')
    expect(read.plannedMealId).toBe(plan.id)
    expect((await searchCookingHistory(a, { recipeId: recipe.id }))[0]?.name).toBe('Rijstschotel')
  })

  test('ieder lid beheert alleen de eigen beoordeling en wijzigen of wissen verandert geen voorraad', async () => {
    const { a, b, prep, rice } = await setup()
    await addMember(db, a.household.id, b.user.id, 'member')
    const member = { ...b, household: { ...a.household, role: 'member' as const } }
    const event = await recordMade(a, { ...confirmation(prep), rating: { score: 8 } })
    await setMyMadeRating(member, { eventId: event.id, score: 6, note: 'Meer kruiden' })
    const changed = await setMyMadeRating(a, { eventId: event.id, score: 9, note: 'Nog eens maken' })
    expect(changed.ratings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userName: 'Anna', score: 9, isMe: true }),
        expect.objectContaining({ userName: 'Bram', score: 6, isMe: false }),
      ]),
    )
    const forged = { eventId: event.id, score: 10, userId: a.user.id }
    await expect(setMyMadeRating(member, forged)).rejects.toBeInstanceOf(Invalid)
    const cleared = await setMyMadeRating(a, { eventId: event.id, score: null, note: '' })
    expect(cleared.ratings).toEqual([expect.objectContaining({ userName: 'Bram', score: 6 })])
    expect(await getPantryItem(a, rice.id)).toMatchObject({ quantity: 850, version: 2 })
  })

  test('andere huishoudens kunnen bereidingen niet lezen of beoordelen en geen bron-ID overnemen', async () => {
    const { a, b, prep, recipe } = await setup()
    const event = await recordMade(a, confirmation(prep))
    b.user.role = 'admin'
    expect(await searchCookingHistory(b)).toEqual([])
    await Promise.all(
      [
        getMadeEvent(b, event.id),
        setMyMadeRating(b, { eventId: event.id, score: 10 }),
        prepareCooking(b, { recipeId: recipe.id }),
        recordMade(b, { ...confirmation(prep), requestId: crypto.randomUUID() }),
      ].map((action) => expect(action).rejects.toBeInstanceOf(NotFound)),
    )
    expect((await getMadeEvent(a, event.id)).ratings).toEqual([])
  })

  test('databaseconstraints voorkomen dubbele verzoeken, dubbele beoordelingen en ongeldige cijfers of afboekingen', async () => {
    const { a, prep } = await setup()
    const event = await recordMade(a, confirmation(prep))
    const [stored] = await db.select().from(madeEvent).where(eq(madeEvent.id, event.id))
    await expect(db.insert(madeEvent).values({ ...stored!, id: crypto.randomUUID() })).rejects.toThrow()
    await expect(
      db
        .insert(madeEvent)
        .values({ ...stored!, id: crypto.randomUUID(), requestId: crypto.randomUUID(), servings: 0 }),
    ).rejects.toThrow()
    const rating = {
      householdId: a.household.id,
      eventId: event.id,
      userId: a.user.id,
      userName: a.user.name,
    }
    await expect(db.insert(madeRating).values({ ...rating, score: 0 })).rejects.toThrow()
    await db.insert(madeRating).values({ ...rating, score: 8 })
    await expect(db.insert(madeRating).values({ ...rating, score: 9 })).rejects.toThrow()
    const [movement] = await db
      .select()
      .from(pantryMovement)
      .where(eq(pantryMovement.householdId, a.household.id))
    await expect(
      db.insert(madeDeduction).values({
        householdId: a.household.id,
        eventId: event.id,
        ingredientId: prep.deductions[0]!.ingredientId,
        movementId: movement!.id,
        quantity: -1,
      }),
    ).rejects.toThrow()
  })
})

describe('statistieken per gerecht', () => {
  test('telt bereidingen, laatste datum en gemiddeld cijfer binnen het eigen huishouden', async () => {
    const { a, b, prep, recipe } = await setup()
    await addMember(db, a.household.id, b.user.id, 'member')
    const member = { ...b, household: { ...a.household, role: 'member' as const } }
    expect((await getRecipeStats(a, [recipe.id])).get(recipe.id)).toBeUndefined()
    const first = await recordMade(a, { ...confirmation(prep), date: '2026-10-01', rating: { score: 8 } })
    await setMyMadeRating(member, { eventId: first.id, score: 6 })
    const next = await prepareCooking(a, { recipeId: recipe.id })
    await recordMade(a, { ...confirmation(next), date: '2026-10-12' })
    expect((await getRecipeStats(a, [recipe.id])).get(recipe.id)).toEqual({
      timesMade: 2,
      lastMade: '2026-10-12',
      averageScore: 7,
      ratingCount: 2,
    })
    expect((await getRecipeStats(b, [recipe.id])).size).toBe(0)
  })
})
