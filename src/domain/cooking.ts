import { createHash } from 'node:crypto'
import { and, asc, desc, eq, gte, ilike, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  madeDeduction,
  madeEvent,
  madeRating,
  pantryItem,
  pantryMovement,
  plannedMeal,
  recipe,
  type CookingSnapshot,
} from '~/db/schema'
import { normalizeIngredientName } from './catalog'
import { calendarDateInput, todayAmsterdam } from './calendar'
import { Conflict, Invalid, NotFound, type Ctx } from './core'
import { parseInput } from './core/validation'
import { getPantryItem } from './pantry'
import { getPlannedMeal } from './planning'
import { getHouseholdPreferences } from './preferences'
import { getRecipe, type RecipeDetail } from './recipes'

const id = z.string().min(1).max(100)
export const prepareCookingInput = z
  .object({
    recipeId: id,
    plannedMealId: id.optional(),
    servings: z.number().int().min(1).max(1000).optional(),
  })
  .strict()
const ratingInput = z
  .object({
    score: z.number().int().min(1).max(10).nullable().default(null),
    note: z.string().trim().max(2000).default(''),
  })
  .strict()
export const myRatingInput = ratingInput.extend({ eventId: id })
export const recordMadeInput = z
  .object({
    requestId: z.string().uuid(),
    recipeId: id,
    recipeVersion: z.number().int().positive(),
    plannedMealId: id.nullable().default(null),
    plannedMealVersion: z.number().int().positive().nullable().default(null),
    date: calendarDateInput,
    servings: z.number().int().min(1).max(1000),
    rating: ratingInput.default({ score: null, note: '' }),
    deductions: z
      .array(
        z
          .object({
            ingredientId: id,
            quantity: z.number().min(0).max(1e12),
            pantryVersion: z.number().int().min(0),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()
export const cookingSearchInput = z
  .object({
    query: z.string().max(160).default(''),
    recipeId: id.optional(),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()

function snapshotOf(item: RecipeDetail): CookingSnapshot {
  const { name, description, servings, tags, ingredients, sections } = item
  return { name, description, servings, tags, ingredients, sections }
}
async function findEvent(ctx: Ctx, eventId: string) {
  const [row] = await ctx.db
    .select()
    .from(madeEvent)
    .where(and(eq(madeEvent.id, eventId), eq(madeEvent.householdId, ctx.household.id)))
  if (!row) throw new NotFound('Bereiding niet gevonden.')
  return row
}

export async function prepareCooking(ctx: Ctx, input: z.input<typeof prepareCookingInput>) {
  const data = parseInput(prepareCookingInput, input)
  const planned = data.plannedMealId ? await getPlannedMeal(ctx, data.plannedMealId) : null
  if (planned && planned.recipeId !== data.recipeId)
    throw new Invalid('Deze geplande maaltijd hoort niet bij dit gerecht.')
  const servings =
    data.servings ?? planned?.effectiveServings ?? (await getHouseholdPreferences(ctx)).defaultServings
  const item = await getRecipe(ctx, data.recipeId, servings)
  const grouped = new Map<
    string,
    {
      ingredientId: string
      name: string
      baseUnit: RecipeDetail['ingredients'][number]['baseUnit']
      required: number | null
    }
  >()
  for (const line of item.ingredients) {
    const previous = grouped.get(line.ingredientId)
    grouped.set(line.ingredientId, {
      ingredientId: line.ingredientId,
      name: line.name,
      baseUnit: line.baseUnit,
      required:
        previous?.required === null || line.baseQuantity === null
          ? null
          : (previous?.required ?? 0) + line.baseQuantity,
    })
  }
  const deductions = await Promise.all(
    [...grouped.values()].map(async (line) => {
      const stock = await getPantryItem(ctx, line.ingredientId)
      return {
        ...line,
        available: stock.quantity,
        staple: stock.staple,
        pantryVersion: stock.version,
        proposed: line.required === null ? 0 : Math.min(line.required, stock.quantity),
        explanation:
          line.required === null
            ? 'Hoeveelheid of exacte omrekening ontbreekt. Geen automatische afboeking; voer alleen zelf een bekende basishoeveelheid in.'
            : null,
      }
    }),
  )
  return {
    requestId: crypto.randomUUID(),
    recipeId: item.id,
    recipeVersion: item.version,
    name: item.name,
    plannedMealId: planned?.id ?? null,
    plannedMealVersion: planned?.version ?? null,
    servings,
    date: todayAmsterdam(),
    deductions,
  }
}

async function writeRating(ctx: Ctx, eventId: string, rating: z.output<typeof ratingInput>) {
  const mine = and(
    eq(madeRating.householdId, ctx.household.id),
    eq(madeRating.eventId, eventId),
    eq(madeRating.userId, ctx.user.id),
  )
  if (rating.score === null && !rating.note) {
    await ctx.db.delete(madeRating).where(mine)
    return
  }
  await ctx.db
    .insert(madeRating)
    .values({
      householdId: ctx.household.id,
      eventId,
      userId: ctx.user.id,
      userName: ctx.user.name,
      ...rating,
    })
    .onConflictDoUpdate({
      target: [madeRating.eventId, madeRating.userId],
      set: { ...rating, userName: ctx.user.name, updatedAt: new Date() },
      setWhere: eq(madeRating.householdId, ctx.household.id),
    })
}

export async function recordMade(ctx: Ctx, input: z.input<typeof recordMadeInput>) {
  const data = parseInput(recordMadeInput, input)
  if (new Set(data.deductions.map((line) => line.ingredientId)).size !== data.deductions.length)
    throw new Invalid('Geef per ingrediënt één afboeking op.')
  if ((data.plannedMealId === null) !== (data.plannedMealVersion === null))
    throw new Invalid('Geef de geplande maaltijd en de versie samen op.')
  data.deductions.sort((a, b) => a.ingredientId.localeCompare(b.ingredientId))
  const inputHash = createHash('sha256').update(JSON.stringify(data)).digest('hex')
  const eventId = await ctx.db.transaction(async (tx) => {
    const txCtx: Ctx = { ...ctx, db: tx }
    async function duplicate() {
      const [existing] = await tx
        .select()
        .from(madeEvent)
        .where(and(eq(madeEvent.householdId, ctx.household.id), eq(madeEvent.requestId, data.requestId)))
      if (existing && (existing.actorId !== ctx.user.id || existing.inputHash !== inputHash))
        throw new Conflict(
          'Dit bevestigingsverzoek is al met andere inhoud gebruikt. Open een nieuw voorstel.',
        )
      return existing?.id
    }
    const existing = await duplicate()
    if (existing) return existing
    const [locked] = await tx
      .select({ id: recipe.id, version: recipe.version })
      .from(recipe)
      .where(and(eq(recipe.id, data.recipeId), eq(recipe.householdId, ctx.household.id)))
      .for('update')
    if (!locked) throw new NotFound('Gerecht niet gevonden.')
    // A concurrent identical request may have committed while this transaction waited for the recipe.
    const repeated = await duplicate()
    if (repeated) return repeated
    if (locked.version !== data.recipeVersion)
      throw new Conflict('Het gerecht is gewijzigd. Controleer een nieuw afboekvoorstel.')
    if (data.plannedMealId) {
      const [plan] = await tx
        .select()
        .from(plannedMeal)
        .where(
          and(
            eq(plannedMeal.id, data.plannedMealId),
            eq(plannedMeal.householdId, ctx.household.id),
            isNull(plannedMeal.deletedAt),
          ),
        )
        .for('update')
      if (!plan) throw new NotFound('Geplande maaltijd niet gevonden.')
      if (plan.version !== data.plannedMealVersion || plan.recipeId !== data.recipeId)
        throw new Conflict('De geplande maaltijd is gewijzigd. Controleer een nieuw voorstel.')
    }
    const item = await getRecipe(txCtx, data.recipeId, data.servings)
    const validIds = new Set(item.ingredients.map((line) => line.ingredientId))
    if (data.deductions.some((line) => !validIds.has(line.ingredientId)))
      throw new Invalid('Je kunt alleen ingrediënten van dit gerecht afboeken.')
    const [event] = await tx
      .insert(madeEvent)
      .values({
        householdId: ctx.household.id,
        recipeId: data.recipeId,
        plannedMealId: data.plannedMealId,
        actorId: ctx.user.id,
        actorName: ctx.user.name,
        date: data.date,
        servings: data.servings,
        recipeVersion: data.recipeVersion,
        requestId: data.requestId,
        inputHash,
        snapshot: snapshotOf(item),
      })
      .onConflictDoNothing({ target: [madeEvent.householdId, madeEvent.requestId] })
      .returning({ id: madeEvent.id })
    if (!event) return (await duplicate())!
    for (const deduction of data.deductions.filter((line) => line.quantity > 0)) {
      const mine = and(
        eq(pantryItem.householdId, ctx.household.id),
        eq(pantryItem.ingredientId, deduction.ingredientId),
      )
      const [before] = await tx.select().from(pantryItem).where(mine)
      if ((before?.version ?? 0) !== deduction.pantryVersion)
        throw new Conflict('De voorraad is gewijzigd. Controleer een nieuw afboekvoorstel.')
      if (!before || before.quantity < deduction.quantity)
        throw new Invalid(
          'Er is onvoldoende getelde voorraad voor deze afboeking. Pas de hoeveelheid aan of corrigeer eerst de voorraad.',
        )
      const [after] = await tx
        .update(pantryItem)
        .set({
          quantity: sql`${pantryItem.quantity} - ${deduction.quantity}`,
          version: deduction.pantryVersion + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            mine,
            eq(pantryItem.version, deduction.pantryVersion),
            gte(pantryItem.quantity, deduction.quantity),
          ),
        )
        .returning({ quantity: pantryItem.quantity })
      if (!after) throw new Conflict('De voorraad is gewijzigd. Controleer een nieuw afboekvoorstel.')
      const [movement] = await tx
        .insert(pantryMovement)
        .values({
          householdId: ctx.household.id,
          ingredientId: deduction.ingredientId,
          actorId: ctx.user.id,
          kind: 'cooked',
          note: `Gemaakt: ${item.name}`,
          previousQuantity: before.quantity,
          quantity: after.quantity,
          previousStaple: before.staple,
          staple: before.staple,
        })
        .returning({ id: pantryMovement.id })
      await tx.insert(madeDeduction).values({
        householdId: ctx.household.id,
        eventId: event.id,
        ingredientId: deduction.ingredientId,
        quantity: deduction.quantity,
        movementId: movement!.id,
      })
    }
    await writeRating(txCtx, event.id, data.rating)
    return event.id
  })
  return getMadeEvent(ctx, eventId)
}

export async function getMadeEvent(ctx: Ctx, eventId: string) {
  const event = await findEvent(ctx, eventId)
  const deductions = await ctx.db
    .select({
      ingredientId: madeDeduction.ingredientId,
      quantity: madeDeduction.quantity,
      previousQuantity: pantryMovement.previousQuantity,
      remainingQuantity: pantryMovement.quantity,
    })
    .from(madeDeduction)
    .innerJoin(
      pantryMovement,
      and(eq(pantryMovement.id, madeDeduction.movementId), eq(pantryMovement.householdId, ctx.household.id)),
    )
    .where(and(eq(madeDeduction.householdId, ctx.household.id), eq(madeDeduction.eventId, event.id)))
  const ratings = await ctx.db
    .select({
      userId: madeRating.userId,
      userName: madeRating.userName,
      score: madeRating.score,
      note: madeRating.note,
      updatedAt: madeRating.updatedAt,
    })
    .from(madeRating)
    .where(and(eq(madeRating.householdId, ctx.household.id), eq(madeRating.eventId, event.id)))
    .orderBy(asc(madeRating.updatedAt), asc(madeRating.userId))
  return {
    id: event.id,
    recipeId: event.recipeId,
    plannedMealId: event.plannedMealId,
    actorName: event.actorName,
    date: event.date,
    servings: event.servings,
    createdAt: event.createdAt,
    snapshot: event.snapshot,
    deductions,
    ratings: ratings.map((rating) => ({ ...rating, isMe: rating.userId === ctx.user.id })),
  }
}
export async function searchCookingHistory(ctx: Ctx, input: z.input<typeof cookingSearchInput> = {}) {
  const data = parseInput(cookingSearchInput, input)
  const query = normalizeIngredientName(data.query)
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
  return ctx.db
    .select({
      id: madeEvent.id,
      name: sql<string>`${madeEvent.snapshot}->>'name'`,
      date: madeEvent.date,
      servings: madeEvent.servings,
      actorName: madeEvent.actorName,
      recipeId: madeEvent.recipeId,
      plannedMealId: madeEvent.plannedMealId,
    })
    .from(madeEvent)
    .where(
      and(
        eq(madeEvent.householdId, ctx.household.id),
        data.recipeId ? eq(madeEvent.recipeId, data.recipeId) : undefined,
        query ? ilike(sql`${madeEvent.snapshot}->>'name'`, pattern) : undefined,
      ),
    )
    .orderBy(desc(madeEvent.date), desc(madeEvent.createdAt), desc(madeEvent.id))
    .limit(data.limit)
}
export async function setMyMadeRating(ctx: Ctx, input: z.input<typeof myRatingInput>) {
  const { eventId, ...rating } = parseInput(myRatingInput, input)
  await findEvent(ctx, eventId)
  await writeRating(ctx, eventId, rating)
  return getMadeEvent(ctx, eventId)
}
export type RecipeStats = {
  timesMade: number
  lastMade: string | null
  averageScore: number | null
  ratingCount: number
}
/** Hoe vaak en wanneer een gerecht gemaakt is en het gemiddelde cijfer van alle beoordelingen. */
export async function getRecipeStats(ctx: Ctx, recipeIds: string[]): Promise<Map<string, RecipeStats>> {
  const stats = new Map<string, RecipeStats>()
  if (!recipeIds.length) return stats
  const made = await ctx.db
    .select({
      recipeId: madeEvent.recipeId,
      timesMade: sql<number>`count(*)::int`,
      lastMade: sql<string>`max(${madeEvent.date})::text`,
    })
    .from(madeEvent)
    .where(and(eq(madeEvent.householdId, ctx.household.id), inArray(madeEvent.recipeId, recipeIds)))
    .groupBy(madeEvent.recipeId)
  const rated = await ctx.db
    .select({
      recipeId: madeEvent.recipeId,
      averageScore: sql<number | null>`avg(${madeRating.score})::float8`,
      ratingCount: sql<number>`count(${madeRating.score})::int`,
    })
    .from(madeRating)
    .innerJoin(
      madeEvent,
      and(eq(madeEvent.id, madeRating.eventId), eq(madeEvent.householdId, ctx.household.id)),
    )
    .where(and(eq(madeRating.householdId, ctx.household.id), inArray(madeEvent.recipeId, recipeIds)))
    .groupBy(madeEvent.recipeId)
  for (const row of made)
    stats.set(row.recipeId, {
      timesMade: row.timesMade,
      lastMade: row.lastMade,
      averageScore: null,
      ratingCount: 0,
    })
  for (const row of rated) {
    const current = stats.get(row.recipeId)
    if (current) Object.assign(current, { averageScore: row.averageScore, ratingCount: row.ratingCount })
  }
  return stats
}
export type CookingPreparation = Awaited<ReturnType<typeof prepareCooking>>
export type MadeEventDetail = Awaited<ReturnType<typeof getMadeEvent>>
