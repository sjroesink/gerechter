import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { ingredient, ingredientConversion } from '~/db/schema'
import { Conflict, NotFound, requireAdmin, type Ctx } from './core'
import { parseInput } from './core/validation'
import { BASE_UNITS, UNIT_IDS, amountInBaseUnit, canonicalConversion } from './units'
import { ingredientPhotoInput } from './ingredient-photo'

const name = z.string().trim().min(1, 'Vul een naam in.').max(160, 'Gebruik maximaal 160 tekens.')
const aliases = z.array(name).max(30, 'Gebruik maximaal 30 aliassen.').default([])
export const createIngredientInput = z
  .object({
    name,
    aliases,
    baseUnit: z.enum(BASE_UNITS),
    scope: z.enum(['household', 'global']).default('household'),
    photo: ingredientPhotoInput.nullable().optional(),
  })
  .strict()
export const updateIngredientInput = z
  .object({ name, aliases, photo: ingredientPhotoInput.nullable().optional() })
  .strict()
export const searchIngredientsInput = z
  .object({
    query: z.string().max(160).default(''),
    includeArchived: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()
export const conversionInput = z
  .object({ unit: z.enum(UNIT_IDS), factor: z.number().positive().max(1e9) })
  .strict()
export type IngredientInput = z.input<typeof createIngredientInput>
export type IngredientUpdate = z.input<typeof updateIngredientInput>

export function normalizeIngredientName(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('nl-NL')
}

const visibleTo = (ctx: Ctx) =>
  or(isNull(ingredient.householdId), eq(ingredient.householdId, ctx.household.id))

function present(ctx: Ctx, row: typeof ingredient.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    baseUnit: row.baseUnit,
    photo: row.photo,
    scope: row.householdId === null ? ('global' as const) : ('household' as const),
    archivedAt: row.archivedAt,
    canManage: row.householdId !== null || ctx.user.role === 'admin',
  }
}

async function find(ctx: Ctx, id: string) {
  const [row] = await ctx.db
    .select()
    .from(ingredient)
    .where(and(eq(ingredient.id, id), visibleTo(ctx)))
  if (!row) throw new NotFound('Ingrediënt niet gevonden.')
  return row
}

function canWrite(ctx: Ctx, row: typeof ingredient.$inferSelect) {
  if (row.householdId === null) requireAdmin(ctx)
}

function uniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ('code' in error && error.code === '23505') return true
  return 'cause' in error && uniqueViolation(error.cause)
}

async function write<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (uniqueViolation(error))
      throw new Conflict(
        'Er bestaat al een ingrediënt met deze naam in deze catalogus. Gebruik het bestaande ingrediënt.',
      )
    throw error
  }
}

export async function searchIngredients(ctx: Ctx, input: z.input<typeof searchIngredientsInput> = {}) {
  const data = parseInput(searchIngredientsInput, input)
  const query = normalizeIngredientName(data.query)
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
  const exact = sql<number>`case when ${ingredient.normalizedName} = ${query} or ${query} = any(${ingredient.aliases}) then 1 else 0 end`
  const score = sql<number>`greatest(similarity(${ingredient.normalizedName}, ${query}), coalesce((select max(similarity(a.value, ${query})) from unnest(${ingredient.aliases}) as a(value)), 0))`
  const matches = query
    ? or(
        ilike(ingredient.normalizedName, pattern),
        sql`exists(select 1 from unnest(${ingredient.aliases}) as a(value) where a.value ilike ${pattern})`,
        sql`${score} >= 0.2`,
      )
    : undefined
  const rows = await ctx.db
    .select()
    .from(ingredient)
    .where(and(visibleTo(ctx), data.includeArchived ? undefined : isNull(ingredient.archivedAt), matches))
    .orderBy(desc(exact), desc(score), asc(ingredient.name), asc(ingredient.id))
    .limit(data.limit)
  return rows.map((row) => present(ctx, row))
}

export async function getIngredient(ctx: Ctx, id: string) {
  const row = await find(ctx, id)
  const conversions = await ctx.db
    .select({ unit: ingredientConversion.unit, factor: ingredientConversion.factor })
    .from(ingredientConversion)
    .where(eq(ingredientConversion.ingredientId, id))
    .orderBy(asc(ingredientConversion.unit))
  return { ...present(ctx, row), conversions }
}

/** Batch voor recepten en voorraad: controleer alle verwijzingen voordat iets wordt geschreven. */
export async function getIngredientsByIds(ctx: Ctx, ids: readonly string[]) {
  const unique = [...new Set(ids)]
  if (unique.length === 0) return new Map<string, Awaited<ReturnType<typeof getIngredient>>>()
  const rows = await ctx.db
    .select()
    .from(ingredient)
    .where(and(inArray(ingredient.id, unique), visibleTo(ctx)))
  if (rows.length !== unique.length) throw new NotFound('Een ingrediënt is niet gevonden.')
  const conversions = await ctx.db
    .select()
    .from(ingredientConversion)
    .where(inArray(ingredientConversion.ingredientId, unique))
  return new Map(
    rows.map((row) => [
      row.id,
      {
        ...present(ctx, row),
        conversions: conversions
          .filter((conversion) => conversion.ingredientId === row.id)
          .map(({ unit, factor }) => ({ unit, factor })),
      },
    ]),
  )
}

export async function createIngredient(ctx: Ctx, input: IngredientInput) {
  const data = parseInput(createIngredientInput, input)
  if (data.scope === 'global') requireAdmin(ctx)
  const [row] = await write(() =>
    ctx.db
      .insert(ingredient)
      .values({
        householdId: data.scope === 'global' ? null : ctx.household.id,
        name: data.name.replace(/\s+/g, ' '),
        normalizedName: normalizeIngredientName(data.name),
        aliases: [...new Set(data.aliases.map(normalizeIngredientName))],
        baseUnit: data.baseUnit,
        photo: data.photo ?? null,
      })
      .returning(),
  )
  return present(ctx, row!)
}

export async function updateIngredient(ctx: Ctx, id: string, input: IngredientUpdate) {
  const data = parseInput(updateIngredientInput, input)
  canWrite(ctx, await find(ctx, id))
  const [row] = await write(() =>
    ctx.db
      .update(ingredient)
      .set({
        name: data.name.replace(/\s+/g, ' '),
        normalizedName: normalizeIngredientName(data.name),
        aliases: [...new Set(data.aliases.map(normalizeIngredientName))],
        updatedAt: new Date(),
        ...(data.photo !== undefined ? { photo: data.photo } : {}),
      })
      .where(and(eq(ingredient.id, id), visibleTo(ctx)))
      .returning(),
  )
  return present(ctx, row!)
}

export async function setIngredientArchived(ctx: Ctx, id: string, archived: boolean) {
  canWrite(ctx, await find(ctx, id))
  const [row] = await ctx.db
    .update(ingredient)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(ingredient.id, id), visibleTo(ctx)))
    .returning()
  return present(ctx, row!)
}

export async function setIngredientConversion(ctx: Ctx, id: string, input: z.input<typeof conversionInput>) {
  const data = parseInput(conversionInput, input)
  const row = await find(ctx, id)
  canWrite(ctx, row)
  const value = canonicalConversion(row.baseUnit, data.unit, data.factor)
  await ctx.db
    .insert(ingredientConversion)
    .values({ ingredientId: id, ...value })
    .onConflictDoUpdate({
      target: [ingredientConversion.ingredientId, ingredientConversion.unit],
      set: { factor: value.factor },
    })
  return getIngredient(ctx, id)
}

export async function removeIngredientConversion(ctx: Ctx, id: string, unit: string) {
  const row = await find(ctx, id)
  canWrite(ctx, row)
  const source = parseInput(z.enum(UNIT_IDS), unit)
  const canonical = canonicalConversion(row.baseUnit, source, 1).unit
  await ctx.db
    .delete(ingredientConversion)
    .where(and(eq(ingredientConversion.ingredientId, id), eq(ingredientConversion.unit, canonical)))
  return getIngredient(ctx, id)
}

export async function convertIngredientAmount(ctx: Ctx, id: string, amount: number, unit: string) {
  const row = await getIngredient(ctx, id)
  const source = parseInput(z.enum(UNIT_IDS), unit)
  return amountInBaseUnit(amount, source, row.baseUnit, row.conversions)
}
