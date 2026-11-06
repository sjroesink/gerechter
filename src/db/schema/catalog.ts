import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { household } from './households'
import type { BaseUnit, Unit } from '../../domain/units'
import type { IngredientPhoto } from '../../domain/ingredient-photo'

export const ingredient = pgTable(
  'ingredient',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id').references(() => household.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    aliases: text('aliases')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    baseUnit: text('base_unit').$type<BaseUnit>().notNull(),
    photo: jsonb('photo').$type<IngredientPhoto>(),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('ingredient_global_name_uq')
      .on(t.normalizedName)
      .where(sql`${t.householdId} is null`),
    uniqueIndex('ingredient_household_name_uq')
      .on(t.householdId, t.normalizedName)
      .where(sql`${t.householdId} is not null`),
    index('ingredient_name_trgm_idx').using('gin', t.normalizedName.op('gin_trgm_ops')),
    check('ingredient_base_unit_check', sql`${t.baseUnit} in ('g', 'ml', 'stuk')`),
  ],
)

export const ingredientConversion = pgTable(
  'ingredient_conversion',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredient.id, { onDelete: 'cascade' }),
    unit: text('unit').$type<Unit>().notNull(),
    factor: doublePrecision('factor').notNull(),
  },
  (t) => [
    uniqueIndex('ingredient_conversion_unit_uq').on(t.ingredientId, t.unit),
    check('ingredient_conversion_factor_check', sql`${t.factor} > 0 and ${t.factor} <= 1000000000`),
    check(
      'ingredient_conversion_unit_check',
      sql`${t.unit} in ('g', 'ml', 'stuk', 'teen', 'blik', 'pak', 'bos', 'plak')`,
    ),
  ],
)
