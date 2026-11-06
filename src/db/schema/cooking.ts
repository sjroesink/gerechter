import { sql } from 'drizzle-orm'
import {
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { InstructionSection } from '../../domain/instructions'
import type { BaseUnit, Unit } from '../../domain/units'
import { user } from './auth'
import { ingredient } from './catalog'
import { household } from './households'
import { pantryMovement } from './pantry'
import { plannedMeal } from './planning'
import { recipe } from './recipes'

export type CookingSnapshot = {
  name: string
  description: string
  servings: number
  tags: string[]
  sections: InstructionSection[]
  ingredients: {
    ingredientId: string
    name: string
    baseUnit: BaseUnit
    archived: boolean
    quantity: number | null
    scaledQuantity: number | null
    unit: Unit
    note: string
    baseQuantity: number | null
  }[]
}
export const madeEvent = pgTable(
  'made_event',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipe.id),
    plannedMealId: text('planned_meal_id').references(() => plannedMeal.id),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    actorName: text('actor_name').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    servings: integer('servings').notNull(),
    recipeVersion: integer('recipe_version').notNull(),
    requestId: text('request_id').notNull(),
    inputHash: text('input_hash').notNull(),
    snapshot: jsonb('snapshot').$type<CookingSnapshot>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('made_event_request_uq').on(t.householdId, t.requestId),
    index('made_event_household_date_idx').on(t.householdId, t.date),
    check('made_event_servings_check', sql`${t.servings} between 1 and 1000`),
    check('made_event_version_check', sql`${t.recipeVersion} > 0`),
    check('made_event_date_check', sql`${t.date} between '0001-01-01'::date and '9999-12-31'::date`),
  ],
)
export const madeDeduction = pgTable(
  'made_deduction',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => madeEvent.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
    quantity: doublePrecision('quantity').notNull(),
    movementId: text('movement_id')
      .notNull()
      .references(() => pantryMovement.id),
  },
  (t) => [
    uniqueIndex('made_deduction_event_ingredient_uq').on(t.eventId, t.ingredientId),
    check('made_deduction_quantity_check', sql`${t.quantity} > 0 and ${t.quantity} <= 1000000000000`),
  ],
)
export const madeRating = pgTable(
  'made_rating',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    eventId: text('event_id')
      .notNull()
      .references(() => madeEvent.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    userName: text('user_name').notNull(),
    score: integer('score'),
    note: text('note').notNull().default(''),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('made_rating_event_user_uq').on(t.eventId, t.userId),
    check('made_rating_score_check', sql`${t.score} is null or ${t.score} between 1 and 10`),
  ],
)
