import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { recipe, recipeIngredient } from '~/db/schema'
import { Conflict, Invalid, NotFound, isDomainError, type Ctx } from './core'
import { deleteImage, downloadImage, imagePath, insertImage, type FetchImage } from './images'
import { parseInput } from './core/validation'
import { getIngredientsByIds, normalizeIngredientName } from './catalog'
import { instructionSectionsInput, validateInstructionSections } from './instructions'
import { UNIT_IDS, amountInBaseUnit } from './units'
import { getHouseholdPreferences } from './preferences'

const httpUrl = z
  .string()
  .url('Vul een geldige URL in.')
  .max(2000)
  .refine((value) => /^https?:\/\//i.test(value), 'Gebruik een http- of https-URL.')
  .nullable()
  .default(null)
export const recipeLineInput = z
  .object({
    ingredientId: z.string().min(1).max(100),
    quantity: z.number().positive().max(1e9).nullable(),
    unit: z.enum(UNIT_IDS),
    note: z.string().max(500).default(''),
  })
  .strict()
export const recipeInput = z
  .object({
    name: z.string().trim().min(1, 'Vul een naam in.').max(160),
    description: z.string().max(5000).default(''),
    servings: z.number().int().min(1).max(1000),
    prepMinutes: z.number().int().min(0).max(10080).nullable().default(null),
    cookMinutes: z.number().int().min(0).max(10080).nullable().default(null),
    sourceUrl: httpUrl,
    photoUrl: httpUrl,
    tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    ingredients: z.array(recipeLineInput).min(1, 'Voeg minstens één ingrediënt toe.').max(200),
    sections: instructionSectionsInput,
  })
  .strict()
export const recipeUpdateInput = recipeInput.extend({ version: z.number().int().positive() })
export const recipeSearchInput = z
  .object({
    query: z.string().max(160).default(''),
    includeArchived: z.boolean().default(false),
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict()
export type RecipeInput = z.input<typeof recipeInput>
export type RecipeUpdate = z.input<typeof recipeUpdateInput>

async function find(ctx: Ctx, id: string) {
  const [row] = await ctx.db
    .select()
    .from(recipe)
    .where(and(eq(recipe.id, id), eq(recipe.householdId, ctx.household.id)))
  if (!row) throw new NotFound('Gerecht niet gevonden.')
  return row
}

function validated(input: RecipeInput) {
  const data = parseInput(recipeInput, input)
  return {
    ...data,
    name: data.name.replace(/\s+/g, ' '),
    tags: [...new Set(data.tags.map(normalizeIngredientName))],
    sections: validateInstructionSections(data.sections),
  }
}

async function checkIngredients(
  ctx: Ctx,
  lines: z.output<typeof recipeLineInput>[],
  retained: readonly string[] = [],
) {
  const ingredients = await getIngredientsByIds(
    ctx,
    lines.map((line) => line.ingredientId),
  )
  for (const item of ingredients.values()) {
    if (item.archivedAt && !retained.includes(item.id))
      throw new Invalid(`Het ingrediënt ${item.name} is gearchiveerd. Kies een actief ingrediënt.`)
  }
}

/** Zonder fetchImage (bijv. in tests) wordt een foto-URL alleen als verwijzing bewaard. */
export type RecipeDeps = { fetchImage?: FetchImage }

/**
 * Downloadt een nieuwe of gewijzigde foto vóór de transactie. Een downloadfout laat het opslaan niet
 * mislukken: het gerecht houdt de originele URL en de aanroeper krijgt een waarschuwing.
 */
async function preparePhoto(
  deps: RecipeDeps,
  data: { photoUrl: string | null; sourceUrl: string | null },
  previousUrl: string | null,
) {
  const { photoUrl, sourceUrl } = data
  if (!photoUrl || photoUrl === previousUrl || !deps.fetchImage) return { download: null, warning: null }
  try {
    return { download: await downloadImage(deps.fetchImage, photoUrl, sourceUrl ?? undefined), warning: null }
  } catch (error) {
    if (!isDomainError(error)) throw error
    return {
      download: null,
      warning: `De foto is niet als eigen kopie opgeslagen: ${error.message} De originele URL wordt getoond.`,
    }
  }
}

function withPhotoWarning<T extends object>(detail: T, warning: string | null) {
  return warning ? { ...detail, photoWarning: warning } : detail
}

export async function createRecipe(ctx: Ctx, input: RecipeInput, deps: RecipeDeps = {}) {
  const data = validated(input)
  await checkIngredients(ctx, data.ingredients)
  const photo = await preparePhoto(deps, data, null)
  const { ingredients, ...metadata } = data
  const id = await ctx.db.transaction(async (tx) => {
    const photoImageId = photo.download ? await insertImage(tx, ctx.household.id, photo.download) : null
    const [row] = await tx
      .insert(recipe)
      .values({
        ...metadata,
        photoImageId,
        normalizedName: normalizeIngredientName(data.name),
        householdId: ctx.household.id,
      })
      .returning({ id: recipe.id })
    await tx.insert(recipeIngredient).values(
      ingredients.map((line, position) => ({
        ...line,
        position,
        householdId: ctx.household.id,
        recipeId: row!.id,
      })),
    )
    return row!.id
  })
  return withPhotoWarning(await getRecipe(ctx, id), photo.warning)
}

export async function updateRecipe(ctx: Ctx, id: string, input: RecipeUpdate, deps: RecipeDeps = {}) {
  const current = await find(ctx, id)
  const parsed = parseInput(recipeUpdateInput, input)
  const { version, ...payload } = parsed
  const data = validated(payload)
  const previous = await ctx.db
    .select({ ingredientId: recipeIngredient.ingredientId })
    .from(recipeIngredient)
    .where(and(eq(recipeIngredient.recipeId, id), eq(recipeIngredient.householdId, ctx.household.id)))
  await checkIngredients(
    ctx,
    data.ingredients,
    previous.map((line) => line.ingredientId),
  )
  if (current.version !== version) throw new Conflict(STALE_RECIPE)
  const photo = await preparePhoto(deps, data, current.photoUrl)
  const { ingredients, ...metadata } = data
  await ctx.db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ version: recipe.version, photoUrl: recipe.photoUrl, photoImageId: recipe.photoImageId })
      .from(recipe)
      .where(and(eq(recipe.id, id), eq(recipe.householdId, ctx.household.id)))
      .for('update')
    if (!locked || locked.version !== version) throw new Conflict(STALE_RECIPE)
    const photoChanged = data.photoUrl !== locked.photoUrl
    const photoImageId = !photoChanged
      ? locked.photoImageId
      : photo.download
        ? await insertImage(tx, ctx.household.id, photo.download)
        : null
    await tx
      .update(recipe)
      .set({
        ...metadata,
        photoImageId,
        normalizedName: normalizeIngredientName(data.name),
        version: version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(recipe.id, id), eq(recipe.householdId, ctx.household.id)))
    if (locked.photoImageId && locked.photoImageId !== photoImageId)
      await deleteImage(tx, ctx.household.id, locked.photoImageId)
    await tx
      .delete(recipeIngredient)
      .where(and(eq(recipeIngredient.recipeId, id), eq(recipeIngredient.householdId, ctx.household.id)))
    await tx.insert(recipeIngredient).values(
      ingredients.map((line, position) => ({
        ...line,
        position,
        householdId: ctx.household.id,
        recipeId: id,
      })),
    )
  })
  return withPhotoWarning(await getRecipe(ctx, id), photo.warning)
}

const STALE_RECIPE = 'Dit gerecht is inmiddels gewijzigd. Open de nieuwste versie en probeer het opnieuw.'

/** Eerder geïmporteerd gerecht met dezelfde bron, ook gearchiveerd; voorkomt dubbele imports. */
export async function findRecipeBySourceUrl(ctx: Ctx, urls: readonly string[]) {
  const candidates = [...new Set(urls.filter(Boolean))]
  if (candidates.length === 0) return null
  const [row] = await ctx.db
    .select({ id: recipe.id, name: recipe.name, archivedAt: recipe.archivedAt })
    .from(recipe)
    .where(and(eq(recipe.householdId, ctx.household.id), inArray(recipe.sourceUrl, candidates)))
    .orderBy(asc(recipe.createdAt))
    .limit(1)
  return row ? { id: row.id, name: row.name, archived: Boolean(row.archivedAt) } : null
}

export async function getRecipe(ctx: Ctx, id: string, requestedServings?: number) {
  const row = await find(ctx, id)
  const servings =
    requestedServings === undefined
      ? row.servings
      : parseInput(z.number().int().min(1).max(1000), requestedServings)
  const lines = await ctx.db
    .select()
    .from(recipeIngredient)
    .where(and(eq(recipeIngredient.recipeId, id), eq(recipeIngredient.householdId, ctx.household.id)))
    .orderBy(asc(recipeIngredient.position))
  const ingredients = await getIngredientsByIds(
    ctx,
    lines.map((line) => line.ingredientId),
  )
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    servings: row.servings,
    viewServings: servings,
    prepMinutes: row.prepMinutes,
    cookMinutes: row.cookMinutes,
    sourceUrl: row.sourceUrl,
    photoUrl: row.photoUrl,
    imageUrl: displayImage(row),
    tags: row.tags,
    sections: row.sections,
    version: row.version,
    archivedAt: row.archivedAt,
    ingredients: lines.map((line) => {
      const item = ingredients.get(line.ingredientId)!
      const scaledQuantity = line.quantity === null ? null : (line.quantity * servings) / row.servings
      const storedBaseQuantity =
        line.quantity === null
          ? null
          : amountInBaseUnit(line.quantity, line.unit, item.baseUnit, item.conversions)
      return {
        ingredientId: item.id,
        name: item.name,
        photo: item.photo,
        baseUnit: item.baseUnit,
        archived: Boolean(item.archivedAt),
        quantity: line.quantity,
        scaledQuantity,
        unit: line.unit,
        note: line.note,
        baseQuantity: storedBaseQuantity === null ? null : (storedBaseQuantity * servings) / row.servings,
      }
    }),
  }
}

export async function searchRecipes(ctx: Ctx, input: z.input<typeof recipeSearchInput> = {}) {
  const data = parseInput(recipeSearchInput, input)
  const query = normalizeIngredientName(data.query)
  const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`
  const rows = await ctx.db
    .select({
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      servings: recipe.servings,
      prepMinutes: recipe.prepMinutes,
      cookMinutes: recipe.cookMinutes,
      photoUrl: recipe.photoUrl,
      photoImageId: recipe.photoImageId,
      tags: recipe.tags,
      archivedAt: recipe.archivedAt,
      version: recipe.version,
    })
    .from(recipe)
    .where(
      and(
        eq(recipe.householdId, ctx.household.id),
        data.includeArchived ? undefined : isNull(recipe.archivedAt),
        query
          ? or(
              ilike(recipe.normalizedName, pattern),
              sql`similarity(${recipe.normalizedName}, ${query}) >= 0.2`,
              sql`exists(select 1 from unnest(${recipe.tags}) as t(value) where t.value ilike ${pattern})`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(recipe.updatedAt), asc(recipe.name), asc(recipe.id))
    .limit(data.limit)
  return rows.map(({ photoImageId, ...row }) => ({
    ...row,
    imageUrl: displayImage({ ...row, photoImageId }),
  }))
}

/** Weergave: de eigen kopie als die er is, anders de originele foto-URL. */
function displayImage(row: { photoUrl: string | null; photoImageId: string | null }) {
  return row.photoImageId ? imagePath(row.photoImageId) : row.photoUrl
}

export async function setRecipeArchived(ctx: Ctx, id: string, archived: boolean) {
  const row = await find(ctx, id)
  if (Boolean(row.archivedAt) !== archived) {
    await ctx.db
      .update(recipe)
      .set({
        archivedAt: archived ? new Date() : null,
        version: sql`${recipe.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(recipe.id, id), eq(recipe.householdId, ctx.household.id)))
  }
  return getRecipe(ctx, id)
}

export type RecipeDetail = Awaited<ReturnType<typeof getRecipe>>

export async function getRecipeForHousehold(ctx: Ctx, id: string, servings?: number) {
  return getRecipe(ctx, id, servings ?? (await getHouseholdPreferences(ctx)).defaultServings)
}
