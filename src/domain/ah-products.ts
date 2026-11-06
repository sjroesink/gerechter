import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { ingredientAhProduct } from '~/db/schema'
import { getIngredient } from './catalog'
import type { Ctx } from './core'
import { parseInput } from './core/validation'
import type { BaseUnit } from './units'

export const MAX_AH_QUANTITY = 99
const ingredientId = z.string().min(1).max(100)
export const linkAhProductInput = z
  .object({
    ingredientId,
    productId: z.number().int().positive().max(2_147_483_647),
    title: z.string().trim().min(1).max(300),
    unitSize: z.string().trim().max(100).nullable().optional(),
    imageUrl: z
      .string()
      .max(2000)
      .url()
      .refine((value) => value.startsWith('https://'), 'Gebruik een https-afbeelding.')
      .nullable()
      .optional(),
    packAmount: z.number().positive('Vul een positieve inhoud in.').max(1e9).nullable().optional(),
  })
  .strict()

export type AhProductLink = {
  ingredientId: string
  productId: number
  title: string
  unitSize: string | null
  imageUrl: string | null
  packAmount: number | null
}

const present = (row: typeof ingredientAhProduct.$inferSelect): AhProductLink => ({
  ingredientId: row.ingredientId,
  productId: row.productId,
  title: row.title,
  unitSize: row.unitSize,
  imageUrl: row.imageUrl,
  packAmount: row.packAmount,
})

const scoped = (ctx: Ctx) => eq(ingredientAhProduct.householdId, ctx.household.id)

export async function getAhProductLinks(ctx: Ctx, ids: readonly string[]) {
  const unique = [...new Set(ids)]
  if (!unique.length) return new Map<string, AhProductLink>()
  const rows = await ctx.db
    .select()
    .from(ingredientAhProduct)
    .where(and(scoped(ctx), inArray(ingredientAhProduct.ingredientId, unique)))
  return new Map(rows.map((row) => [row.ingredientId, present(row)]))
}

export async function getAhProductLink(ctx: Ctx, id: string) {
  await getIngredient(ctx, parseInput(ingredientId, id))
  return (await getAhProductLinks(ctx, [id])).get(id) ?? null
}

/** Any member may choose the product for their own household, also for a global ingredient. */
export async function linkAhProduct(ctx: Ctx, input: z.input<typeof linkAhProductInput>) {
  const data = parseInput(linkAhProductInput, input)
  await getIngredient(ctx, data.ingredientId)
  const fields = {
    productId: data.productId,
    title: data.title,
    unitSize: data.unitSize || null,
    imageUrl: data.imageUrl ?? null,
    packAmount: data.packAmount ?? null,
    updatedAt: new Date(),
  }
  const [row] = await ctx.db
    .insert(ingredientAhProduct)
    .values({ householdId: ctx.household.id, ingredientId: data.ingredientId, ...fields })
    .onConflictDoUpdate({
      target: [ingredientAhProduct.householdId, ingredientAhProduct.ingredientId],
      set: fields,
    })
    .returning()
  return present(row!)
}

export async function unlinkAhProduct(ctx: Ctx, id: string) {
  await getIngredient(ctx, parseInput(ingredientId, id))
  const removed = await ctx.db
    .delete(ingredientAhProduct)
    .where(and(scoped(ctx), eq(ingredientAhProduct.ingredientId, id)))
    .returning({ id: ingredientAhProduct.id })
  return { removed: removed.length > 0 }
}

const unitFactors: Record<string, { base: BaseUnit; factor: number }> = {
  kg: { base: 'g', factor: 1000 },
  kilo: { base: 'g', factor: 1000 },
  g: { base: 'g', factor: 1 },
  gr: { base: 'g', factor: 1 },
  gram: { base: 'g', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  lt: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 },
  dl: { base: 'ml', factor: 100 },
  cl: { base: 'ml', factor: 10 },
  ml: { base: 'ml', factor: 1 },
  st: { base: 'stuk', factor: 1 },
  stuk: { base: 'stuk', factor: 1 },
  stuks: { base: 'stuk', factor: 1 },
}

/**
 * Proposes pack contents in the ingredient's base unit from AH's size text ("1 kg", "2 x 250 g",
 * "ca. 500 g", "per stuk"). Returns null for anything unrecognised or in another dimension.
 */
export function parseUnitSize(unitSize: string | null | undefined, baseUnit: BaseUnit): number | null {
  if (!unitSize) return null
  const text = unitSize.toLocaleLowerCase('nl-NL').replace(/(\d),(\d)/g, '$1.$2')
  if (/^\s*per\s+stuk\s*$/.test(text)) return baseUnit === 'stuk' ? 1 : null
  if (/\bper\b|\blos\b/.test(text)) return null
  const match = /(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*([a-z]+)\b/.exec(text)
  if (!match) return null
  const unit = unitFactors[match[3]!]
  if (!unit || unit.base !== baseUnit) return null
  const amount = Number(match[2]) * unit.factor * (match[1] ? Number(match[1]) : 1)
  return Number.isFinite(amount) && amount > 0 && amount <= 1e9 ? amount : null
}

/** Number of packs to buy; never guesses a conversion. `check` asks the user to verify. */
export function ahQuantity(
  line: { needed: number; unknown: readonly unknown[] },
  packAmount: number | null,
): { quantity: number; check: boolean } {
  if (line.needed > 0 && packAmount)
    return {
      quantity: Math.min(MAX_AH_QUANTITY, Math.max(1, Math.ceil(line.needed / packAmount - 1e-9))),
      check: line.unknown.length > 0,
    }
  return { quantity: 1, check: true }
}
