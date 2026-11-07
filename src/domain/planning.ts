import { and, asc, eq, gte, isNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import { plannedMeal, recipe } from '~/db/schema'
import { calendarDateInput, shiftDate, todayAmsterdam, weekDates } from './calendar'
import { Conflict, Invalid, NotFound, type Ctx } from './core'
import { parseInput } from './core/validation'
import { getHouseholdPreferences } from './preferences'
import { displayImage, getRecipe } from './recipes'

const common = { date: calendarDateInput, note: z.string().max(2000).default('') }
const plannedRecipeInput = z
  .object({
    ...common,
    kind: z.literal('recipe'),
    recipeId: z.string().min(1).max(100),
    servings: z.number().int().min(1).max(1000).nullable().default(null),
  })
  .strict()
const plannedFreeInput = z
  .object({ ...common, kind: z.literal('free'), title: z.string().trim().min(1).max(160) })
  .strict()
export const plannedMealInput = z.discriminatedUnion('kind', [plannedRecipeInput, plannedFreeInput])
export const plannedMealUpdateInput = z.discriminatedUnion('kind', [
  plannedRecipeInput.extend({ version: z.number().int().positive() }),
  plannedFreeInput.extend({ version: z.number().int().positive() }),
])
export const planDateInput = z.object({ date: calendarDateInput }).strict()
export type PlannedMealInput = z.input<typeof plannedMealInput>
export type PlannedMealUpdate = z.input<typeof plannedMealUpdateInput>

const scoped = (ctx: Ctx, id: string) =>
  and(eq(plannedMeal.id, id), eq(plannedMeal.householdId, ctx.household.id), isNull(plannedMeal.deletedAt))
async function find(ctx: Ctx, id: string) {
  const [row] = await ctx.db.select().from(plannedMeal).where(scoped(ctx, id))
  if (!row) throw new NotFound('Geplande maaltijd niet gevonden.')
  return row
}
async function validateRecipe(ctx: Ctx, input: z.output<typeof plannedMealInput>, retained?: string | null) {
  if (input.kind !== 'recipe') return
  const item = await getRecipe(ctx, input.recipeId)
  if (item.archivedAt && item.id !== retained)
    throw new Invalid('Dit gerecht is gearchiveerd. Kies een actief gerecht.')
}
function fields(input: z.output<typeof plannedMealInput>) {
  return {
    date: input.date,
    kind: input.kind,
    recipeId: input.kind === 'recipe' ? input.recipeId : null,
    title: input.kind === 'free' ? input.title : null,
    servings: input.kind === 'recipe' ? input.servings : null,
    note: input.note,
  }
}
export async function createPlannedMeal(ctx: Ctx, input: PlannedMealInput) {
  const data = parseInput(plannedMealInput, input)
  await validateRecipe(ctx, data)
  const [row] = await ctx.db
    .insert(plannedMeal)
    .values({ householdId: ctx.household.id, ...fields(data) })
    .returning({ id: plannedMeal.id })
  return getPlannedMeal(ctx, row!.id)
}
export async function updatePlannedMeal(ctx: Ctx, id: string, input: PlannedMealUpdate) {
  const before = await find(ctx, id)
  const { version, ...data } = parseInput(plannedMealUpdateInput, input)
  await validateRecipe(ctx, data, before.recipeId)
  const rows = await ctx.db
    .update(plannedMeal)
    .set({ ...fields(data), version: version + 1, updatedAt: new Date() })
    .where(and(scoped(ctx, id), eq(plannedMeal.version, version)))
    .returning({ id: plannedMeal.id })
  if (rows.length === 0)
    throw new Conflict('Deze maaltijd is inmiddels gewijzigd. Open de nieuwste versie en probeer opnieuw.')
  return getPlannedMeal(ctx, id)
}
export async function removePlannedMeal(ctx: Ctx, id: string, version: number) {
  await find(ctx, id)
  parseInput(z.number().int().positive(), version)
  const rows = await ctx.db
    .update(plannedMeal)
    .set({ deletedAt: new Date(), updatedAt: new Date(), version: version + 1 })
    .where(and(scoped(ctx, id), eq(plannedMeal.version, version)))
    .returning({ id: plannedMeal.id })
  if (rows.length === 0)
    throw new Conflict('Deze maaltijd is inmiddels gewijzigd. Open de nieuwste versie en probeer opnieuw.')
  return { removed: true }
}
export async function getPlannedMeal(ctx: Ctx, id: string) {
  const row = await find(ctx, id)
  const { defaultServings } = await getHouseholdPreferences(ctx)
  const effectiveServings = row.kind === 'recipe' ? (row.servings ?? defaultServings) : null
  const recipe = row.recipeId ? await getRecipe(ctx, row.recipeId, effectiveServings!) : null
  return {
    id: row.id,
    date: row.date,
    kind: row.kind,
    title: recipe?.name ?? row.title!,
    recipeId: row.recipeId,
    servings: row.servings,
    effectiveServings,
    note: row.note,
    version: row.version,
    recipe,
  }
}

export async function getPlanRange(ctx: Ctx, from: string, through: string) {
  parseInput(calendarDateInput, from)
  parseInput(calendarDateInput, through)
  if (through < from || through > shiftDate(from, 31))
    throw new Invalid('Kies een periode van maximaal 32 dagen.')
  const { defaultServings } = await getHouseholdPreferences(ctx)
  const rows = await ctx.db
    .select({
      id: plannedMeal.id,
      date: plannedMeal.date,
      kind: plannedMeal.kind,
      recipeId: plannedMeal.recipeId,
      freeTitle: plannedMeal.title,
      recipeName: recipe.name,
      recipeArchivedAt: recipe.archivedAt,
      photoUrl: recipe.photoUrl,
      photoImageId: recipe.photoImageId,
      servings: plannedMeal.servings,
      note: plannedMeal.note,
      version: plannedMeal.version,
    })
    .from(plannedMeal)
    .leftJoin(recipe, and(eq(recipe.id, plannedMeal.recipeId), eq(recipe.householdId, ctx.household.id)))
    .where(
      and(
        eq(plannedMeal.householdId, ctx.household.id),
        isNull(plannedMeal.deletedAt),
        gte(plannedMeal.date, from),
        lte(plannedMeal.date, through),
      ),
    )
    .orderBy(asc(plannedMeal.date), asc(plannedMeal.createdAt), asc(plannedMeal.id))
  return {
    defaultServings,
    items: rows.map(({ recipeName, freeTitle, photoUrl, photoImageId, ...row }) => ({
      ...row,
      title: recipeName ?? freeTitle ?? 'Gerecht niet beschikbaar',
      imageUrl: recipeName ? displayImage({ photoUrl, photoImageId }) : null,
      effectiveServings: row.kind === 'recipe' ? (row.servings ?? defaultServings) : null,
    })),
  }
}
export async function getDayPlan(ctx: Ctx, date: string) {
  return { date, ...(await getPlanRange(ctx, date, date)) }
}
export async function getWeekPlan(ctx: Ctx, date = todayAmsterdam()) {
  const dates = weekDates(date)
  const plan = await getPlanRange(ctx, dates[0]!, dates[6]!)
  return {
    start: dates[0]!,
    end: dates[6]!,
    previous: shiftDate(dates[0]!, -7),
    next: shiftDate(dates[0]!, 7),
    defaultServings: plan.defaultServings,
    days: dates.map((day) => ({ date: day, items: plan.items.filter((item) => item.date === day) })),
  }
}
export type PlannedMealDetail = Awaited<ReturnType<typeof getPlannedMeal>>
export type PlanSummary = Awaited<ReturnType<typeof getPlanRange>>['items'][number]
