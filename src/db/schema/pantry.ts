import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { user } from './auth'
import { ingredient } from './catalog'
import { household } from './households'

export const pantryItem = pgTable(
  'pantry_item',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
    quantity: doublePrecision('quantity').notNull().default(0),
    staple: boolean('staple').notNull().default(false),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('pantry_item_household_ingredient_uq').on(t.householdId, t.ingredientId),
    check('pantry_item_quantity_check', sql`${t.quantity} >= 0 and ${t.quantity} <= 1000000000000`),
    check('pantry_item_version_check', sql`${t.version} > 0`),
  ],
)

export const pantryMovement = pgTable(
  'pantry_movement',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredient.id),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    kind: text('kind', { enum: ['count', 'correction', 'removed', 'cooked'] }).notNull(),
    note: text('note').notNull().default(''),
    previousQuantity: doublePrecision('previous_quantity').notNull(),
    quantity: doublePrecision('quantity').notNull(),
    previousStaple: boolean('previous_staple').notNull(),
    staple: boolean('staple').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('pantry_movement_household_ingredient_idx').on(t.householdId, t.ingredientId, t.createdAt),
    check(
      'pantry_movement_quantity_check',
      sql`${t.previousQuantity} >= 0 and ${t.previousQuantity} <= 1000000000000 and ${t.quantity} >= 0 and ${t.quantity} <= 1000000000000`,
    ),
    check('pantry_movement_kind_check', sql`${t.kind} in ('count', 'correction', 'removed', 'cooked')`),
  ],
)

export const householdPreferences = pgTable(
  'household_preferences',
  {
    householdId: text('household_id')
      .primaryKey()
      .references(() => household.id, { onDelete: 'cascade' }),
    defaultServings: integer('default_servings').notNull().default(2),
  },
  (t) => [check('household_preferences_servings_check', sql`${t.defaultServings} between 1 and 1000`)],
)
