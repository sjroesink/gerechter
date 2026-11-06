import { and, asc, desc, eq, gt, ilike, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ingredient, pantryItem, pantryMovement, user } from '~/db/schema'
import { getIngredient, normalizeIngredientName } from './catalog'
import { Conflict, Invalid, type Ctx } from './core'
import { parseInput } from './core/validation'
import { amountInBaseUnit, UNIT_IDS } from './units'

export const pantrySearchInput = z
  .object({ query: z.string().max(160).default(''), includeEmpty: z.boolean().default(false) })
  .strict()
export const pantrySetInput = z
  .object({
    ingredientId: z.string().min(1).max(100),
    quantity: z.number().min(0).max(1e12),
    unit: z.enum(UNIT_IDS),
    staple: z.boolean(),
    version: z.number().int().min(0),
    reason: z.enum(['count', 'correction']).default('count'),
    note: z.string().max(1000).default(''),
  })
  .strict()
export const pantryRemoveInput = z
  .object({ ingredientId: z.string().min(1).max(100), version: z.number().int().min(1) })
  .strict()
const scoped = (ctx: Ctx, ingredientId: string) =>
  and(eq(pantryItem.householdId, ctx.household.id), eq(pantryItem.ingredientId, ingredientId))

export async function getPantryItem(ctx: Ctx, ingredientId: string) {
  const item = await getIngredient(ctx, ingredientId)
  const [row] = await ctx.db.select().from(pantryItem).where(scoped(ctx, ingredientId))
  return {
    ingredientId,
    name: item.name,
    photo: item.photo,
    baseUnit: item.baseUnit,
    archived: Boolean(item.archivedAt),
    quantity: row?.quantity ?? 0,
    staple: row?.staple ?? false,
    version: row?.version ?? 0,
    updatedAt: row?.updatedAt ?? null,
  }
}

export async function listPantry(ctx: Ctx, input: z.input<typeof pantrySearchInput> = {}) {
  const data = parseInput(pantrySearchInput, input)
  const query = normalizeIngredientName(data.query)
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
  return ctx.db
    .select({
      ingredientId: ingredient.id,
      name: ingredient.name,
      photo: ingredient.photo,
      baseUnit: ingredient.baseUnit,
      archivedAt: ingredient.archivedAt,
      quantity: pantryItem.quantity,
      staple: pantryItem.staple,
      version: pantryItem.version,
    })
    .from(pantryItem)
    .innerJoin(ingredient, eq(ingredient.id, pantryItem.ingredientId))
    .where(
      and(
        eq(pantryItem.householdId, ctx.household.id),
        or(isNull(ingredient.householdId), eq(ingredient.householdId, ctx.household.id)),
        data.includeEmpty ? undefined : or(gt(pantryItem.quantity, 0), eq(pantryItem.staple, true)),
        query
          ? or(
              ilike(ingredient.normalizedName, pattern),
              sql`exists(select 1 from unnest(${ingredient.aliases}) as a(value) where a.value ilike ${pattern})`,
            )
          : undefined,
      ),
    )
    .orderBy(asc(ingredient.name), asc(ingredient.id))
}

// Called inside one transaction: an expected version prevents stale counts and duplicate audit entries.
async function writeCount(
  ctx: Ctx,
  data: {
    ingredientId: string
    version: number
    quantity: number
    staple: boolean
    reason: 'count' | 'correction' | 'removed'
    note: string
  },
) {
  await ctx.db.transaction(async (tx) => {
    const [before] = await tx.select().from(pantryItem).where(scoped(ctx, data.ingredientId))
    if ((before?.version ?? 0) !== data.version)
      throw new Conflict(
        'Deze voorraad is inmiddels gewijzigd. Open de nieuwste telling en probeer het opnieuw.',
      )
    const next = {
      quantity: data.quantity,
      staple: data.staple,
      version: data.version + 1,
      updatedAt: new Date(),
    }
    const written =
      data.version === 0
        ? await tx
            .insert(pantryItem)
            .values({ householdId: ctx.household.id, ingredientId: data.ingredientId, ...next })
            .onConflictDoNothing({ target: [pantryItem.householdId, pantryItem.ingredientId] })
            .returning({ id: pantryItem.id })
        : await tx
            .update(pantryItem)
            .set(next)
            .where(and(scoped(ctx, data.ingredientId), eq(pantryItem.version, data.version)))
            .returning({ id: pantryItem.id })
    if (written.length === 0)
      throw new Conflict(
        'Deze voorraad is inmiddels gewijzigd. Open de nieuwste telling en probeer het opnieuw.',
      )
    await tx.insert(pantryMovement).values({
      householdId: ctx.household.id,
      ingredientId: data.ingredientId,
      actorId: ctx.user.id,
      kind: data.reason,
      note: data.note,
      previousQuantity: before?.quantity ?? 0,
      quantity: data.quantity,
      previousStaple: before?.staple ?? false,
      staple: data.staple,
    })
  })
}

export async function setPantryItem(ctx: Ctx, input: z.input<typeof pantrySetInput>) {
  const data = parseInput(pantrySetInput, input)
  const item = await getIngredient(ctx, data.ingredientId)
  const current = await getPantryItem(ctx, data.ingredientId)
  if (item.archivedAt && current.version === 0)
    throw new Invalid('Kies een actief ingrediënt om nieuwe voorraad toe te voegen.')
  const quantity =
    data.unit === item.baseUnit
      ? data.quantity
      : amountInBaseUnit(data.quantity, data.unit, item.baseUnit, item.conversions)
  if (quantity === null)
    throw new Invalid(
      'Voor deze eenheid is geen exacte omrekening bekend. Gebruik de basiseenheid of leg eerst een bekende omrekening vast.',
    )
  if (!Number.isFinite(quantity) || quantity > 1e12)
    throw new Invalid('De omgerekende hoeveelheid is te groot.')
  await writeCount(ctx, { ...data, quantity })
  return getPantryItem(ctx, data.ingredientId)
}

export async function removePantryItem(ctx: Ctx, input: z.input<typeof pantryRemoveInput>) {
  const data = parseInput(pantryRemoveInput, input)
  await getIngredient(ctx, data.ingredientId)
  await writeCount(ctx, {
    ...data,
    quantity: 0,
    staple: false,
    reason: 'removed',
    note: 'Verwijderd uit voorraad',
  })
  return getPantryItem(ctx, data.ingredientId)
}

export async function getPantryHistory(ctx: Ctx, ingredientId: string) {
  await getIngredient(ctx, ingredientId)
  return ctx.db
    .select({
      id: pantryMovement.id,
      kind: pantryMovement.kind,
      note: pantryMovement.note,
      actorName: user.name,
      previousQuantity: pantryMovement.previousQuantity,
      quantity: pantryMovement.quantity,
      previousStaple: pantryMovement.previousStaple,
      staple: pantryMovement.staple,
      createdAt: pantryMovement.createdAt,
    })
    .from(pantryMovement)
    .leftJoin(user, eq(user.id, pantryMovement.actorId))
    .where(
      and(eq(pantryMovement.householdId, ctx.household.id), eq(pantryMovement.ingredientId, ingredientId)),
    )
    .orderBy(desc(pantryMovement.createdAt), desc(pantryMovement.id))
    .limit(100)
}

export type PantryDetail = Awaited<ReturnType<typeof getPantryItem>>
