// Productie-start: controleer configuratie, voer migraties uit en start pas daarna de server.
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { runMigrations, migrationsFolder } from './migrate.mjs'

// Houd gelijk met de verplichte velden in src/lib/env.ts (die valideert ook het formaat).
export const REQUIRED_ENV = ['DATABASE_URL', 'PUBLIC_BASE_URL', 'BETTER_AUTH_SECRET', 'ADMIN_EMAIL']

export async function startServer({
  env = process.env,
  folder = migrationsFolder,
  importServer = () =>
    import(
      pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.output/server/index.mjs'))
        .href
    ),
} = {}) {
  const missing = REQUIRED_ENV.filter((name) => !env[name])
  if (missing.length > 0) {
    throw new Error(`Ontbrekende omgevingsvariabele(n): ${missing.join(', ')}`)
  }
  try {
    await runMigrations(env.DATABASE_URL, folder)
  } catch (error) {
    throw new Error(`Databasemigratie mislukt: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    })
  }
  return importServer()
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await startServer()
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
