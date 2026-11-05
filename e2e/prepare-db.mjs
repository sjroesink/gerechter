// Begint elke e2e-run met een lege, gemigreerde database (draait vóór de e2e-webserver).
import pg from 'pg'
import { runMigrations } from '../scripts/migrate.mjs'

const url = process.env.DATABASE_URL
const name = new URL(url).pathname.slice(1)
if (!/^gerechter_e2e$/.test(name)) throw new Error(`Weiger om database ${name} te resetten`)
const adminUrl = new URL(url)
adminUrl.pathname = '/postgres'
const client = new pg.Client({ connectionString: adminUrl.toString() })
await client.connect()
await client.query(`drop database if exists ${name} with (force)`)
await client.query(`create database ${name}`)
await client.end()
await runMigrations(url)
console.log(`e2e-database ${name} klaar`)
