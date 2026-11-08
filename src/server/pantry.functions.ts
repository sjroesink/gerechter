import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getIngredient } from '~/domain/catalog'
import { getAhProductLink } from '~/domain/ah-products'
import {
  getPantryHistory,
  getPantryItem,
  listPantry,
  pantryRemoveInput,
  pantrySearchInput,
  pantrySetInput,
  removePantryItem,
  setPantryItem,
} from '~/domain/pantry'
import { preferencesInput, setHouseholdPreferences } from '~/domain/preferences'
import { sessionCtx, toResult } from './fn'

export const getPantryPage = createServerFn({ method: 'GET' })
  .validator(pantrySearchInput)
  .handler(({ data }) => toResult(async () => listPantry(await sessionCtx(), data)))
export const getPantryDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ ingredientId: z.string().min(1).max(100) }))
  .handler(({ data }) =>
    toResult(async () => {
      const ctx = await sessionCtx()
      const { aliases, scope, conversions } = await getIngredient(ctx, data.ingredientId)
      return {
        item: await getPantryItem(ctx, data.ingredientId),
        ingredient: { aliases, scope, conversions },
        ahProduct: await getAhProductLink(ctx, data.ingredientId),
        history: await getPantryHistory(ctx, data.ingredientId),
      }
    }),
  )
export const setPantryFn = createServerFn({ method: 'POST' })
  .validator(pantrySetInput)
  .handler(({ data }) => toResult(async () => setPantryItem(await sessionCtx(), data)))
export const removePantryFn = createServerFn({ method: 'POST' })
  .validator(pantryRemoveInput)
  .handler(({ data }) => toResult(async () => removePantryItem(await sessionCtx(), data)))
export const setPreferencesFn = createServerFn({ method: 'POST' })
  .validator(preferencesInput)
  .handler(({ data }) => toResult(async () => setHouseholdPreferences(await sessionCtx(), data)))
