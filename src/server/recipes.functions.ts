import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createRecipe,
  getRecipeForHousehold,
  recipeInput,
  recipeSearchInput,
  recipeUpdateInput,
  searchRecipes,
  setRecipeArchived,
  updateRecipe,
} from '~/domain/recipes'
import { getRecipeStats } from '~/domain/cooking'
import { getPantryItem } from '~/domain/pantry'
import { sessionCtx, toResult } from './fn'
import { recipeImportDeps } from './recipe-import/runtime'

const id = z.string().min(1).max(100)
export const getRecipesPage = createServerFn({ method: 'GET' })
  .validator(recipeSearchInput)
  .handler(({ data }) =>
    toResult(async () => {
      const ctx = await sessionCtx()
      const rows = await searchRecipes(ctx, data)
      const stats = await getRecipeStats(
        ctx,
        rows.map((row) => row.id),
      )
      return rows.map((row) => ({ ...row, stats: stats.get(row.id) ?? null }))
    }),
  )
export const getRecipePage = createServerFn({ method: 'GET' })
  .validator(z.object({ recipeId: id, servings: z.number().int().min(1).max(1000).optional() }))
  .handler(({ data }) =>
    toResult(async () => {
      const ctx = await sessionCtx()
      const item = await getRecipeForHousehold(ctx, data.recipeId, data.servings)
      const stats = (await getRecipeStats(ctx, [item.id])).get(item.id) ?? null
      const ids = [...new Set(item.ingredients.map((line) => line.ingredientId))]
      const stock = await Promise.all(
        ids.map(async (ingredientId) => {
          const pantry = await getPantryItem(ctx, ingredientId)
          return { ingredientId, quantity: pantry.quantity, staple: pantry.staple }
        }),
      )
      return { ...item, stats, stock }
    }),
  )
export const createRecipeFn = createServerFn({ method: 'POST' })
  .validator(recipeInput)
  .handler(({ data }) => toResult(async () => createRecipe(await sessionCtx(), data, recipeImportDeps())))
export const updateRecipeFn = createServerFn({ method: 'POST' })
  .validator(recipeUpdateInput.extend({ recipeId: id }))
  .handler(({ data }) =>
    toResult(async () => {
      const { recipeId, ...input } = data
      return updateRecipe(await sessionCtx(), recipeId, input, recipeImportDeps())
    }),
  )
export const archiveRecipeFn = createServerFn({ method: 'POST' })
  .validator(z.object({ recipeId: id, archived: z.boolean() }))
  .handler(({ data }) =>
    toResult(async () => setRecipeArchived(await sessionCtx(), data.recipeId, data.archived)),
  )
