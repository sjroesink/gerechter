import { parseEnv, type Env } from '../../scripts/env.mjs'

export { EnvError, parseEnv, type Env } from '../../scripts/env.mjs'

let cached: Env | undefined

export function env(): Env {
  cached ??= parseEnv(process.env)
  return cached
}
