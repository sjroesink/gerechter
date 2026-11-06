import { sql } from 'drizzle-orm'
import { check, date, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { household } from './households'
import { recipe } from './recipes'

export const plannedMeal = pgTable(
  'planned_meal',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    kind: text('kind', { enum: ['recipe', 'free'] }).notNull(),
    recipeId: text('recipe_id').references(() => recipe.id),
    title: text('title'),
    servings: integer('servings'),
    note: text('note').notNull().default(''),
    version: integer('version').notNull().default(1),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('planned_meal_household_date_idx').on(t.householdId, t.date),
    check(
      'planned_meal_shape_check',
      sql`(${t.kind} = 'recipe' and ${t.recipeId} is not null and ${t.title} is null) or (${t.kind} = 'free' and ${t.recipeId} is null and ${t.servings} is null and length(trim(${t.title})) > 0 and ${t.title} is not null)`,
    ),
    check('planned_meal_servings_check', sql`${t.servings} is null or ${t.servings} between 1 and 1000`),
    check('planned_meal_version_check', sql`${t.version} > 0`),
    check('planned_meal_date_check', sql`${t.date} between '0001-01-01'::date and '9999-12-31'::date`),
  ],
)
