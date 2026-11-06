import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { calendarDateInput, todayAmsterdam } from '~/domain/calendar'
import {
  createPlannedMeal,
  getDayPlan,
  getPlannedMeal,
  getWeekPlan,
  plannedMealInput,
  plannedMealUpdateInput,
  removePlannedMeal,
  updatePlannedMeal,
} from '~/domain/planning'
import { getHouseholdPreferences } from '~/domain/preferences'
import { getRecipe } from '~/domain/recipes'
import { sessionCtx, toResult } from './fn'

const id = z.string().min(1).max(100)
export const getWeekPage = createServerFn({ method: 'GET' })
  .validator(z.object({ date: calendarDateInput.optional() }))
  .handler(({ data }) => toResult(async () => getWeekPlan(await sessionCtx(), data.date)))
export const getDayPage = createServerFn({ method: 'GET' })
  .validator(z.object({ date: calendarDateInput }))
  .handler(({ data }) => toResult(async () => getDayPlan(await sessionCtx(), data.date)))
export const getPlannedMealPage = createServerFn({ method: 'GET' })
  .validator(z.object({ mealId: id }))
  .handler(({ data }) =>
    toResult(async () => {
      const ctx = await sessionCtx()
      return { item: await getPlannedMeal(ctx, data.mealId), preferences: await getHouseholdPreferences(ctx) }
    }),
  )
export const getNewPlanPage = createServerFn({ method: 'GET' })
  .validator(z.object({ date: calendarDateInput.optional(), recipeId: id.optional() }))
  .handler(({ data }) =>
    toResult(async () => {
      const ctx = await sessionCtx()
      const recipe = data.recipeId ? await getRecipe(ctx, data.recipeId) : null
      return {
        date: data.date ?? todayAmsterdam(),
        preferences: await getHouseholdPreferences(ctx),
        recipe: recipe ? { id: recipe.id, name: recipe.name } : undefined,
      }
    }),
  )
export const createPlannedMealFn = createServerFn({ method: 'POST' })
  .validator(plannedMealInput)
  .handler(({ data }) => toResult(async () => createPlannedMeal(await sessionCtx(), data)))
export const updatePlannedMealFn = createServerFn({ method: 'POST' })
  .validator(z.object({ mealId: id, input: plannedMealUpdateInput }))
  .handler(({ data }) => toResult(async () => updatePlannedMeal(await sessionCtx(), data.mealId, data.input)))
export const removePlannedMealFn = createServerFn({ method: 'POST' })
  .validator(z.object({ mealId: id, version: z.number().int().positive() }))
  .handler(({ data }) =>
    toResult(async () => removePlannedMeal(await sessionCtx(), data.mealId, data.version)),
  )
