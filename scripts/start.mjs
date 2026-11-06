// Productie-start: controleer configuratie, voer migraties uit en start pas daarna de server.
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import { runMigrations, migrationsFolder } from './migrate.mjs'
import { parseEnv } from './env.mjs'

export async function startServer({
  env = process.env,
  folder = migrationsFolder,
  importServer = () =>
    import(
      pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.output/server/index.mjs'))
        .href
    ),
} = {}) {
  const config = parseEnv(env)
  try {
    await runMigrations(config.DATABASE_URL, folder)
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
