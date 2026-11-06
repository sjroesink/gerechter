import { eq } from 'drizzle-orm'
import { describe, expect, test } from 'vitest'
import { plannedMeal } from '~/db/schema'
import { setupTestDb } from '../../tests/db'
import { twoHouseholds } from '../../tests/fixtures'
import { createIngredient } from './catalog'
import { Conflict, Invalid, NotFound } from './core'
import {
  createPlannedMeal,
  getDayPlan,
  getPlannedMeal,
  getWeekPlan,
  removePlannedMeal,
  updatePlannedMeal,
} from './planning'
import { setHouseholdPreferences } from './preferences'
import { createRecipe, getRecipe, setRecipeArchived } from './recipes'

const db = setupTestDb()
async function setup() {
  const { a, b } = await twoHouseholds(db)
  const rice = await createIngredient(a, { name: 'Rijst', baseUnit: 'g' })
  const recipe = await createRecipe(a, {
    name: 'Rijst met groenten',
    servings: 2,
    ingredients: [{ ingredientId: rice.id, quantity: 200, unit: 'g' }],
  })
  const input = {
    kind: 'recipe' as const,
    recipeId: recipe.id,
    date: '2027-01-01',
    servings: null,
    note: 'Samen eten',
  }
  return { a, b, recipe, input }
}

describe('week- en dagplanning', () => {
  test('plant meerdere items en toont maandag tot zondag inclusief lege dagen over de jaargrens', async () => {
    const { a, input } = await setup()
    const first = await createPlannedMeal(a, input)
    const free = await createPlannedMeal(a, {
      kind: 'free',
      title: 'Restjes',
      date: input.date,
      note: 'Uit de koelkast',
    })
    const week = await getWeekPlan(a, input.date)
    expect(week).toMatchObject({
      start: '2026-12-28',
      end: '2027-01-03',
      previous: '2026-12-21',
      next: '2027-01-04',
    })
    expect(week.days).toHaveLength(7)
    expect(week.days.filter((day) => day.items.length === 0)).toHaveLength(6)
    expect(week.days[4]?.items.map((item) => item.id)).toEqual([first.id, free.id])
    expect((await getDayPlan(a, input.date)).items).toHaveLength(2)
    expect((await getDayPlan(a, '2027-01-02')).items).toEqual([])
    expect(await getPlannedMeal(a, free.id)).toMatchObject({
      kind: 'free',
      title: 'Restjes',
      recipeId: null,
      recipe: null,
      effectiveServings: null,
    })
  })

  test('huishoudporties zijn dynamisch en een expliciete overschrijving schaalt alleen de maaltijd', async () => {
    const { a, recipe, input } = await setup()
    const meal = await createPlannedMeal(a, input)
    expect(meal.effectiveServings).toBe(2)
    await setHouseholdPreferences(a, { defaultServings: 4 })
    expect((await getPlannedMeal(a, meal.id)).recipe?.ingredients[0]?.scaledQuantity).toBe(400)
    const changed = await updatePlannedMeal(a, meal.id, { ...input, servings: 3, version: 1 })
    expect(changed).toMatchObject({ version: 2, servings: 3, effectiveServings: 3 })
    expect(changed.recipe?.ingredients[0]?.baseQuantity).toBe(300)
    expect((await getDayPlan(a, input.date)).items[0]?.effectiveServings).toBe(3)
    expect((await getRecipe(a, recipe.id)).ingredients[0]?.quantity).toBe(200)
    const reset = await updatePlannedMeal(a, meal.id, { ...input, version: 2 })
    expect(reset.effectiveServings).toBe(4)
  })

  test('verplaatsen en wisselen tussen gerecht en vrije tekst wist de andere velden', async () => {
    const { a, input } = await setup()
    const meal = await createPlannedMeal(a, input)
    const free = await updatePlannedMeal(a, meal.id, {
      kind: 'free',
      title: 'Bestellen',
      date: '2027-01-03',
      version: 1,
    })
    expect(free).toMatchObject({
      recipeId: null,
      recipe: null,
      servings: null,
      title: 'Bestellen',
      version: 2,
    })
    expect((await getDayPlan(a, input.date)).items).toEqual([])
    const restored = await updatePlannedMeal(a, meal.id, { ...input, version: 2 })
    expect(restored.title).toBe('Rijst met groenten')
    expect(restored.recipeId).toBe(input.recipeId)
  })

  test('bestaande gearchiveerde gerechten blijven leesbaar en verplaatsbaar maar niet nieuw te plannen', async () => {
    const { a, recipe, input } = await setup()
    const meal = await createPlannedMeal(a, input)
    await setRecipeArchived(a, recipe.id, true)
    expect((await getPlannedMeal(a, meal.id)).recipe?.archivedAt).toBeInstanceOf(Date)
    expect((await getDayPlan(a, input.date)).items[0]?.recipeArchivedAt).toBeInstanceOf(Date)
    await expect(createPlannedMeal(a, input)).rejects.toBeInstanceOf(Invalid)
    await expect(
      updatePlannedMeal(a, meal.id, { ...input, date: '2027-01-04', version: 1 }),
    ).resolves.toMatchObject({ date: '2027-01-04' })
  })

  test('afscherming geldt voor lijsten, detail, wijzigingen en onzichtbare receptverwijzingen', async () => {
    const { a, b, input } = await setup()
    const meal = await createPlannedMeal(a, input)
    b.user.role = 'admin'
    expect((await getDayPlan(b, input.date)).items).toEqual([])
    expect((await getWeekPlan(b, input.date)).days.every((day) => day.items.length === 0)).toBe(true)
    await Promise.all(
      [
        getPlannedMeal(b, meal.id),
        createPlannedMeal(b, input),
        updatePlannedMeal(b, meal.id, { ...input, version: 1 }),
        removePlannedMeal(b, meal.id, 1),
      ].map((action) => expect(action).rejects.toBeInstanceOf(NotFound)),
    )
    expect((await getPlannedMeal(a, meal.id)).version).toBe(1)
    const free = await createPlannedMeal(b, { kind: 'free', title: 'Eigen maaltijd', date: input.date })
    await expect(updatePlannedMeal(b, free.id, { ...input, version: 1 })).rejects.toBeInstanceOf(NotFound)
    expect((await getPlannedMeal(b, free.id)).title).toBe('Eigen maaltijd')
  })

  test('gelijktijdig wijzigen en verwijderen heeft één winnaar zonder overschrijven', async () => {
    const { a, input } = await setup()
    const meal = await createPlannedMeal(a, input)
    const updates = await Promise.allSettled([
      updatePlannedMeal(a, meal.id, { ...input, note: 'A', version: 1 }),
      updatePlannedMeal(a, meal.id, { ...input, note: 'B', version: 1 }),
    ])
    expect(updates.filter((row) => row.status === 'fulfilled')).toHaveLength(1)
    const failed = updates.find((row) => row.status === 'rejected')
    expect(failed?.status === 'rejected' && failed.reason).toBeInstanceOf(Conflict)
    await expect(removePlannedMeal(a, meal.id, 1)).rejects.toBeInstanceOf(Conflict)
    const attempts = await Promise.allSettled([
      updatePlannedMeal(a, meal.id, { ...input, note: 'C', version: 2 }),
      removePlannedMeal(a, meal.id, 2),
    ])
    expect(attempts.filter((row) => row.status === 'fulfilled')).toHaveLength(1)
    expect(attempts.filter((row) => row.status === 'rejected')).toHaveLength(1)
  })

  test('verwijderen behoudt de databaseverwijzing en verwijdert het item uit alle actieve weergaven', async () => {
    const { a, input } = await setup()
    const meal = await createPlannedMeal(a, input)
    await removePlannedMeal(a, meal.id, 1)
    await expect(getPlannedMeal(a, meal.id)).rejects.toBeInstanceOf(NotFound)
    expect((await getDayPlan(a, input.date)).items).toEqual([])
    const [stored] = await db.select().from(plannedMeal).where(eq(plannedMeal.id, meal.id))
    expect(stored).toMatchObject({ recipeId: input.recipeId, deletedAt: expect.any(Date), version: 2 })
  })

  test('ongeldige vorm en datums worden vóór schrijven geweigerd en databasechecks bewaken de vorm', async () => {
    const { a, input } = await setup()
    for (const date of ['2026-02-29', '2026-02-30', '2027-01-01T00:00:00Z'])
      await expect(createPlannedMeal(a, { ...input, date })).rejects.toBeInstanceOf(Invalid)
    for (const servings of [0, 1.5, 1001])
      await expect(createPlannedMeal(a, { ...input, servings })).rejects.toBeInstanceOf(Invalid)
    await expect(createPlannedMeal(a, { kind: 'free', title: ' ', date: input.date })).rejects.toBeInstanceOf(
      Invalid,
    )
    const row = { householdId: a.household.id, date: input.date, kind: 'recipe' as const }
    await expect(db.insert(plannedMeal).values(row)).rejects.toThrow()
    await expect(
      db.insert(plannedMeal).values({ ...row, recipeId: input.recipeId, title: 'mag niet' }),
    ).rejects.toThrow()
    await expect(
      db.insert(plannedMeal).values({ ...row, recipeId: input.recipeId, servings: 0 }),
    ).rejects.toThrow()
    await expect(
      db.insert(plannedMeal).values({ ...row, kind: 'free', title: 'Restjes', servings: 2 }),
    ).rejects.toThrow()
    await expect(db.insert(plannedMeal).values({ ...row, kind: 'free', title: null })).rejects.toThrow()
    await expect(
      db.insert(plannedMeal).values({ ...row, recipeId: input.recipeId, version: 0 }),
    ).rejects.toThrow()
    await expect(db.insert(plannedMeal).values({ ...row, recipeId: 'onbekend' })).rejects.toThrow()
    expect((await getDayPlan(a, input.date)).items).toEqual([])
  })
})
