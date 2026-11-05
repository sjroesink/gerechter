import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { user } from './auth'

export const household = pgTable('household', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const householdRoles = ['owner', 'member'] as const
export type HouseholdRole = (typeof householdRoles)[number]

export const membership = pgTable(
  'membership',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: householdRoles }).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('membership_household_user_uq').on(t.householdId, t.userId),
    index('membership_user_idx').on(t.userId),
  ],
)

export const inviteKinds = ['member', 'new_household'] as const
export type InviteKind = (typeof inviteKinds)[number]

export const invite = pgTable(
  'invite',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    tokenHash: text('token_hash').notNull(),
    kind: text('kind', { enum: inviteKinds }).notNull(),
    householdId: text('household_id').references(() => household.id, { onDelete: 'cascade' }),
    proposedHouseholdName: text('proposed_household_name'),
    createdBy: text('created_by')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    usedAt: timestamp('used_at'),
    usedBy: text('used_by').references(() => user.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('invite_token_hash_uq').on(t.tokenHash),
    index('invite_household_idx').on(t.householdId),
  ],
)
