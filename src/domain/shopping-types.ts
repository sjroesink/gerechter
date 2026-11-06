import type { BaseUnit, Unit } from './units'
import type { IngredientPhoto } from './ingredient-photo'

export type ShoppingSource =
  | { kind: 'recipe'; recipeId: string; servings: number }
  | { kind: 'day'; date: string }
  | { kind: 'week'; date: string }
export type ShoppingLine = {
  ingredientId: string
  name: string
  photo?: IngredientPhoto | null
  baseUnit: BaseUnit
  required: number
  available: number
  needed: number
  pantryVersion: number
  unknown: { quantity: number | null; unit: Unit; note: string; recipeName: string; reason: string }[]
}
export type ShoppingNeeds = {
  source: ShoppingSource
  title: string
  sourceKeys: string[]
  sources: {
    key: string
    recipeId: string
    recipeVersion: number
    mealVersion: number | null
    servings: number
    name: string
  }[]
  items: ShoppingLine[]
  staples: ShoppingLine[]
  covered: ShoppingLine[]
  ignored: { id: string; title: string; reason: 'free' | 'made' }[]
  lines: string[]
  text: string
  fingerprint: string
}
