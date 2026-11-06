import { z } from 'zod'
import { parseUnitSize } from './ah-products'
import { getIngredient } from './catalog'
import { Invalid, type Ctx } from './core'
import { parseInput } from './core/validation'
import { getAhConnectionForMember } from './shopping-sync'
import type { ShoppingDeps } from './shopping-target'

export const searchAhProductsInput = z
  .object({
    query: z.string().trim().min(1, 'Vul een zoekterm in.').max(100),
    ingredientId: z.string().min(1).max(100).optional(),
    limit: z.number().int().min(1).max(30).default(20),
  })
  .strict()

/** Read-only search in the AH assortment; suggests pack contents for the given ingredient. */
export async function searchAhProducts(
  ctx: Ctx,
  input: z.input<typeof searchAhProductsInput>,
  deps: ShoppingDeps,
) {
  const data = parseInput(searchAhProductsInput, input)
  const baseUnit = data.ingredientId ? (await getIngredient(ctx, data.ingredientId)).baseUnit : null
  if (!deps.ahProducts) throw new Invalid('AH is niet ingeschakeld op deze installatie.')
  const connection = await getAhConnectionForMember(ctx, deps.secret)
  if (!connection)
    throw new Invalid(
      'Dit huishouden heeft nog geen AH-verbinding. Laat een eigenaar AH koppelen bij Boodschappen › Verbindingen.',
    )
  const products = await deps.ahProducts.search(connection, data.query, data.limit)
  return products.map((product) => ({
    ...product,
    suggestedPackAmount: baseUnit ? parseUnitSize(product.unitSize, baseUnit) : null,
  }))
}
