import { sql } from 'drizzle-orm'
import { check, customType, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { household } from './households'

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => 'bytea' })

/** Eigen kopie van een gedownloade afbeelding (bijv. een gerechtfoto), per huishouden afgeschermd. */
export const image = pgTable(
  'image',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    contentType: text('content_type').notNull(),
    bytes: bytea('bytes').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    sourceUrl: text('source_url'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('image_household_idx').on(t.householdId),
    check(
      'image_content_type_check',
      sql`${t.contentType} in ('image/jpeg','image/png','image/webp','image/gif','image/avif')`,
    ),
    check('image_byte_size_check', sql`${t.byteSize} > 0`),
  ],
)
