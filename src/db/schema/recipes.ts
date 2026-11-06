import { sql } from 'drizzle-orm'
import {
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { household } from './households'
import { ingredient } from './catalog'
import { image } from './images'
import type { InstructionSection } from '../../domain/instructions'
import type { Unit } from '../../domain/units'

export const recipe = pgTable(
  'recipe',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    description: text('description').notNull().default(''),
    servings: integer('servings').notNull(),
    prepMinutes: integer('prep_minutes'),
    cookMinutes: integer('cook_minutes'),
    sourceUrl: text('source_url'),
    photoUrl: text('photo_url'),
    /** Eigen kopie van photoUrl; photoUrl blijft de verwijzing naar het origineel. */
    photoImageId: text('photo_image_id').references(() => image.id, { onDelete: 'set null' }),
    tags: text('tags')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    sections: jsonb('sections').$type<InstructionSection[]>().notNull().default([]),
    version: integer('version').notNull().default(1),
    archivedAt: timestamp('archived_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('recipe_household_idx').on(t.householdId),
    index('recipe_name_trgm_idx').using('gin', t.normalizedName.op('gin_trgm_ops')),
    index('recipe_tags_idx').using('gin', t.tags),
    check('recipe_servings_check', sql`${t.servings} between 1 and 1000`),
    check('recipe_version_check', sql`${t.version} > 0`),
    check(
      'recipe_times_check',
      sql`(${t.prepMinutes} is null or ${t.prepMinutes} between 0 and 10080) and (${t.cookMinutes} is null or ${t.cookMinutes} between 0 and 10080)`,
    ),
  ],
)

export const recipeIngredient = pgTable(
  'recipe_ingredient',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipe.id, { onDelete: 'cascade' }),
    ingredientId: text('ingredient_id')
      .notNull()
      .references(() => ingredient.id, { onDelete: 'restrict' }),
    quantity: doublePrecision('quantity'),
    unit: text('unit').$type<Unit>().notNull(),
    note: text('note').notNull().default(''),
    position: integer('position').notNull(),
  },
  (t) => [
    uniqueIndex('recipe_ingredient_position_uq').on(t.recipeId, t.position),
    index('recipe_ingredient_household_idx').on(t.householdId, t.recipeId),
    check(
      'recipe_ingredient_quantity_check',
      sql`${t.quantity} is null or (${t.quantity} > 0 and ${t.quantity} <= 1000000000)`,
    ),
    check('recipe_ingredient_position_check', sql`${t.position} >= 0`),
    check(
      'recipe_ingredient_unit_check',
      sql`${t.unit} in ('g','kg','ml','l','tl','el','stuk','teen','blik','pak','bos','plak','snuf','handje','scheut')`,
    ),
  ],
)
