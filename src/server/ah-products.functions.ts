import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { searchAhProducts, searchAhProductsInput } from '~/domain/ah-product-search'
import { linkAhProduct, linkAhProductInput, unlinkAhProduct } from '~/domain/ah-products'
import { sessionCtx, toResult } from './fn'
import { shoppingDeps } from './shopping-targets'

export const searchAhProductsFn = createServerFn({ method: 'POST' })
  .validator(searchAhProductsInput)
  .handler(({ data }) => toResult(async () => searchAhProducts(await sessionCtx(), data, shoppingDeps())))
export const linkAhProductFn = createServerFn({ method: 'POST' })
  .validator(linkAhProductInput)
  .handler(({ data }) => toResult(async () => linkAhProduct(await sessionCtx(), data)))
export const unlinkAhProductFn = createServerFn({ method: 'POST' })
  .validator(z.object({ ingredientId: z.string().min(1).max(100) }).strict())
  .handler(({ data }) => toResult(async () => unlinkAhProduct(await sessionCtx(), data.ingredientId)))
