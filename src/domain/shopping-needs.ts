import { createHash } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { madeEvent } from '~/db/schema'
import { ahQuantity, getAhProductLinks, MAX_AH_QUANTITY } from './ah-products'
import { calendarDateInput, weekDates } from './calendar'
import { Invalid, type Ctx } from './core'
import { parseInput } from './core/validation'
import { getPantryItem } from './pantry'
import { getPlanRange } from './planning'
import { getHouseholdPreferences } from './preferences'
import { getRecipe } from './recipes'
import type {
  AhExportItem,
  AhLineProduct,
  ShoppingLine,
  ShoppingNeeds,
  ShoppingSource,
} from './shopping-types'
import type { IngredientPhoto } from './ingredient-photo'
import { measurementUnit } from './units'

const id = z.string().min(1).max(100)
export const shoppingSourceInput = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('recipe'),
      recipeId: id,
      servings: z.number().int().min(1).max(1000).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('day'), date: calendarDateInput }).strict(),
  z.object({ kind: z.literal('week'), date: calendarDateInput }).strict(),
])
const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 8 })
/** `skip` leaves those items to buy off this calculation; unknown ids are refused. */
export async function calculateShoppingNeeds(
  ctx: Ctx,
  input: z.input<typeof shoppingSourceInput>,
  options: { skip?: readonly string[] } = {},
): Promise<ShoppingNeeds> {
  const data = parseInput(shoppingSourceInput, input)
  const source: ShoppingSource =
    data.kind === 'recipe'
      ? { ...data, servings: data.servings ?? (await getHouseholdPreferences(ctx)).defaultServings }
      : data.kind === 'week'
        ? { ...data, date: weekDates(data.date)[0]! }
        : data
  const recipes: { key: string; mealVersion: number | null; item: Awaited<ReturnType<typeof getRecipe>> }[] =
    []
  const ignored: ShoppingNeeds['ignored'] = []
  let title: string
  if (source.kind === 'recipe') {
    const item = await getRecipe(ctx, source.recipeId, source.servings)
    recipes.push({ key: `recipe:${item.id}`, mealVersion: null, item })
    title = `${item.name} · ${source.servings} porties`
  } else {
    const dates = source.kind === 'week' ? weekDates(source.date) : [source.date]
    const plan = await getPlanRange(ctx, dates[0]!, dates.at(-1)!)
    const ids = plan.items.map((item) => item.id)
    const made = ids.length
      ? await ctx.db
          .select({ plannedMealId: madeEvent.plannedMealId })
          .from(madeEvent)
          .where(and(eq(madeEvent.householdId, ctx.household.id), inArray(madeEvent.plannedMealId, ids)))
      : []
    const cooked = new Set(made.map((event) => event.plannedMealId))
    for (const item of plan.items) {
      if (item.kind === 'free' || cooked.has(item.id)) {
        ignored.push({ id: item.id, title: item.title, reason: item.kind === 'free' ? 'free' : 'made' })
      } else {
        recipes.push({
          key: `planned:${item.id}`,
          mealVersion: item.version,
          item: await getRecipe(ctx, item.recipeId!, item.effectiveServings!),
        })
      }
    }
    title = source.kind === 'week' ? `Week ${dates[0]} t/m ${dates.at(-1)}` : `Dag ${source.date}`
  }
  const grouped = new Map<string, Omit<ShoppingLine, 'available' | 'needed' | 'pantryVersion'>>()
  const photos = new Map<string, IngredientPhoto | null>()
  for (const { item } of recipes) {
    for (const line of item.ingredients) {
      photos.set(line.ingredientId, line.photo)
      const current = grouped.get(line.ingredientId) ?? {
        ingredientId: line.ingredientId,
        name: line.name,
        baseUnit: line.baseUnit,
        required: 0,
        unknown: [],
      }
      if (line.baseQuantity === null)
        current.unknown.push({
          quantity: line.scaledQuantity,
          unit: line.unit,
          note: line.note,
          recipeName: item.name,
          reason:
            line.scaledQuantity === null
              ? 'hoeveelheid onbekend / naar smaak'
              : measurementUnit(line.unit).dimension === 'vague'
                ? 'vage eenheid'
                : 'omrekening onbekend',
        })
      else current.required += line.baseQuantity
      grouped.set(line.ingredientId, current)
    }
  }
  const items: ShoppingLine[] = [],
    staples: ShoppingLine[] = [],
    covered: ShoppingLine[] = []
  for (const line of [...grouped.values()].sort(
    (a, b) => a.name.localeCompare(b.name, 'nl') || a.ingredientId.localeCompare(b.ingredientId),
  )) {
    const stock = await getPantryItem(ctx, line.ingredientId)
    const result = {
      ...line,
      available: stock.quantity,
      needed: Math.max(0, line.required - stock.quantity),
      pantryVersion: stock.version,
    }
    if (stock.staple) staples.push(result)
    else if (result.needed > 0 || result.unknown.length > 0) items.push(result)
    else covered.push(result)
  }
  const skip = new Set(options.skip)
  const skipped = items.filter((item) => skip.has(item.ingredientId))
  if (skipped.length !== skip.size) throw new Invalid('Een overgeslagen item hoort niet bij dit voorstel.')
  if (skipped.length) items.splice(0, items.length, ...items.filter((item) => !skip.has(item.ingredientId)))
  const textLines = (item: ShoppingLine) => [
    ...(item.needed > 0 ? [`${number.format(item.needed)} ${item.baseUnit} · ${item.name}`] : []),
    ...item.unknown.map(
      (line) =>
        `${item.name} · ${line.quantity === null ? 'naar smaak' : `${number.format(line.quantity)} ${line.unit}`} (${line.reason}; controleer zelf)${line.note ? ` · ${line.note}` : ''}`,
    ),
  ]
  const lines = items.flatMap(textLines)
  // The AH list gets one short line per ingredient; notes and conversion remarks stay in the app.
  const ahText = (item: ShoppingLine) => {
    const amounts = [
      ...(item.needed > 0 ? [`${number.format(item.needed)} ${item.baseUnit}`] : []),
      ...item.unknown.flatMap((line) =>
        line.quantity === null ? [] : [`${number.format(line.quantity)} ${line.unit}`],
      ),
    ]
    const text = amounts.length ? `${item.name} (${amounts.join(' + ')})` : item.name
    return text.length > 80 ? item.name.slice(0, 80) : text
  }
  const links = await getAhProductLinks(
    ctx,
    items.map((item) => item.ingredientId),
  )
  const ahProducts = new Map<string, AhLineProduct>()
  const ahItems: AhExportItem[] = []
  for (const item of items) {
    const link = links.get(item.ingredientId)
    if (!link) {
      ahItems.push({ kind: 'text', description: ahText(item) })
      continue
    }
    const { quantity, check } = ahQuantity(item, link.packAmount)
    ahProducts.set(item.ingredientId, { ...link, quantity, check })
    const same = ahItems.find((entry) => entry.kind === 'product' && entry.productId === link.productId)
    if (same?.kind === 'product') {
      same.quantity = Math.min(MAX_AH_QUANTITY, same.quantity + quantity)
      same.check ||= check
    } else
      ahItems.push({ kind: 'product', productId: link.productId, description: link.title, quantity, check })
  }
  const sources = recipes
    .map(({ key, mealVersion, item }) => ({
      key,
      recipeId: item.id,
      recipeVersion: item.version,
      mealVersion,
      servings: item.viewServings,
      name: item.name,
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
  const content = {
    source,
    title,
    sourceKeys: sources.map((item) => item.key),
    sources,
    items,
    ...(skipped.length ? { skipped } : {}),
    staples,
    covered,
    ignored,
    lines,
    ahItems,
  }
  // Pack contents change what a later export would send, so they invalidate an open proposal too.
  const linkKey = [...ahProducts].map(([id, product]) => [id, product.productId, product.packAmount])
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(linkKey.length ? { ...content, linkKey } : content))
    .digest('hex')
  const text = [
    `Boodschappen · ${title}`,
    '',
    ...(lines.length ? lines.map((line) => `☐ ${line}`) : ['Geen boodschappen nodig.']),
    ...(skipped.length
      ? ['', `Al in huis (overgeslagen): ${skipped.map((item) => item.name).join(', ')}`]
      : []),
    ...(staples.length
      ? ['', `Basisvoorraad (niet toegevoegd): ${staples.map((item) => item.name).join(', ')}`]
      : []),
    ...(ignored.length
      ? [
          '',
          `Niet meegerekend: ${ignored.map((item) => `${item.title} (${item.reason === 'made' ? 'al gemaakt' : 'vrije maaltijd'})`).join(', ')}`,
        ]
      : []),
  ].join('\n')
  // Images decorate the read model after hashing; changing a photo never invalidates a shopping proposal.
  const withPhotos = (rows: ShoppingLine[]) =>
    rows.map((line) => ({ ...line, photo: photos.get(line.ingredientId) ?? null }))
  return {
    ...content,
    items: withPhotos(items).map((line) => ({
      ...line,
      ahProduct: ahProducts.get(line.ingredientId) ?? null,
    })),
    staples: withPhotos(staples),
    covered: withPhotos(covered),
    text,
    fingerprint,
  }
}
export async function prepareShopping(ctx: Ctx, input: z.input<typeof shoppingSourceInput>) {
  return { ...(await calculateShoppingNeeds(ctx, input)), requestId: crypto.randomUUID() }
}
