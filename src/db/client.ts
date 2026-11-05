import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema'
import { env } from '~/lib/env'

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10 })
  return Object.assign(drizzle({ client: pool, schema, casing: 'snake_case' }), { $pool: pool })
}

export type Db = ReturnType<typeof createDb>

let instance: Db | undefined

export function db(): Db {
  instance ??= createDb(env().DATABASE_URL)
  return instance
}

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx
