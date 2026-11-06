import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createIngredient,
  createIngredientInput,
  getIngredient,
  removeIngredientConversion,
  searchIngredients,
  searchIngredientsInput,
  setIngredientArchived,
  setIngredientConversion,
  conversionInput,
  updateIngredient,
  updateIngredientInput,
} from '~/domain/catalog'
import { UNIT_IDS } from '~/domain/units'
import { sessionCtx, toResult } from './fn'

const id = z.string().min(1).max(100)
export const getCatalog = createServerFn({ method: 'GET' })
  .validator(searchIngredientsInput)
  .handler(({ data }) => toResult(async () => searchIngredients(await sessionCtx(), data)))
export const getIngredientPage = createServerFn({ method: 'GET' })
  .validator(z.object({ ingredientId: id }))
  .handler(({ data }) => toResult(async () => getIngredient(await sessionCtx(), data.ingredientId)))
export const createIngredientFn = createServerFn({ method: 'POST' })
  .validator(createIngredientInput)
  .handler(({ data }) => toResult(async () => createIngredient(await sessionCtx(), data)))
export const updateIngredientFn = createServerFn({ method: 'POST' })
  .validator(updateIngredientInput.extend({ ingredientId: id }))
  .handler(({ data }) =>
    toResult(async () => {
      const { ingredientId, ...input } = data
      return updateIngredient(await sessionCtx(), ingredientId, input)
    }),
  )
export const archiveIngredientFn = createServerFn({ method: 'POST' })
  .validator(z.object({ ingredientId: id, archived: z.boolean() }))
  .handler(({ data }) =>
    toResult(async () => setIngredientArchived(await sessionCtx(), data.ingredientId, data.archived)),
  )
export const setConversionFn = createServerFn({ method: 'POST' })
  .validator(conversionInput.extend({ ingredientId: id }))
  .handler(({ data }) =>
    toResult(async () => {
      const { ingredientId, ...input } = data
      return setIngredientConversion(await sessionCtx(), ingredientId, input)
    }),
  )
export const removeConversionFn = createServerFn({ method: 'POST' })
  .validator(z.object({ ingredientId: id, unit: z.enum(UNIT_IDS) }))
  .handler(({ data }) =>
    toResult(async () => removeIngredientConversion(await sessionCtx(), data.ingredientId, data.unit)),
  )
