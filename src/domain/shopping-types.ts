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
  /** Linked AH product for this household; only on lines to buy. */
  ahProduct?: AhLineProduct | null
}
export type AhLineProduct = {
  productId: number
  title: string
  unitSize: string | null
  imageUrl: string | null
  packAmount: number | null
  quantity: number
  check: boolean
}
export type AhExportItem =
  | { kind: 'product'; productId: number; description: string; quantity: number; check: boolean }
  | { kind: 'text'; description: string }
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
  /** AH export: linked products plus text lines for the rest. Absent in snapshots from before links. */
  ahItems?: AhExportItem[]
  text: string
  fingerprint: string
}
