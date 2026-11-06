import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import type { ShoppingNeeds, ShoppingSource } from '../../domain/shopping-types'
import { user } from './auth'
import { household } from './households'

export const shoppingTargets = ['share', 'notion', 'ah'] as const
export type ShoppingTargetId = (typeof shoppingTargets)[number]
export const syncStatuses = [
  'pending',
  'succeeded',
  'failed',
  'uncertain',
  'copied',
  'shared',
  'cancelled',
] as const
export type SyncStatus = (typeof syncStatuses)[number]
export const shoppingConnection = pgTable(
  'shopping_connection',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    target: text('target', { enum: ['notion', 'ah'] }).notNull(),
    destinationId: text('destination_id').notNull(),
    encryptedSecret: text('encrypted_secret').notNull(),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('shopping_connection_household_target_uq').on(t.householdId, t.target),
    check('shopping_connection_target_check', sql`${t.target} in ('notion', 'ah')`),
    check('shopping_connection_version_check', sql`${t.version} > 0`),
  ],
)

export const syncRun = pgTable(
  'sync_run',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    requestId: text('request_id').notNull(),
    requestHash: text('request_hash').notNull(),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    actorName: text('actor_name').notNull(),
    target: text('target', { enum: shoppingTargets }).notNull(),
    targetKey: text('target_key').notNull(),
    connectionId: text('connection_id').references(() => shoppingConnection.id, { onDelete: 'set null' }),
    source: jsonb('source').$type<ShoppingSource>().notNull(),
    sourceKeys: text('source_keys').array().notNull(),
    fingerprint: text('fingerprint').notNull(),
    snapshot: jsonb('snapshot').$type<ShoppingNeeds>().notNull(),
    status: text('status', { enum: syncStatuses }).notNull().default('pending'),
    externalId: text('external_id'),
    externalUrl: text('external_url'),
    message: text('message'),
    checkedAt: timestamp('checked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('sync_run_request_uq').on(t.householdId, t.requestId),
    index('sync_run_household_created_idx').on(t.householdId, t.createdAt),
    check('sync_run_target_check', sql`${t.target} in ('share','notion','ah')`),
    check(
      'sync_run_status_check',
      sql`${t.status} in ('pending','succeeded','failed','uncertain','copied','shared','cancelled')`,
    ),
  ],
)

export const syncSourceClaim = pgTable(
  'sync_source_claim',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    householdId: text('household_id')
      .notNull()
      .references(() => household.id, { onDelete: 'cascade' }),
    targetKey: text('target_key').notNull(),
    sourceKey: text('source_key').notNull(),
    runId: text('run_id')
      .notNull()
      .references(() => syncRun.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('sync_source_claim_uq').on(t.householdId, t.targetKey, t.sourceKey)],
)
