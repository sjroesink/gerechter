// Voert openstaande Drizzle-migraties uit. Gebruikt door `pnpm db:migrate`, de server-start en tests.
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

export const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle')

export async function runMigrations(connectionString, folder = migrationsFolder) {
  const pool = new pg.Pool({ connectionString, max: 1 })
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: folder })
  } finally {
    await pool.end()
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL ontbreekt')
    process.exit(1)
  }
  await runMigrations(url)
  console.log('Migraties uitgevoerd')
}
