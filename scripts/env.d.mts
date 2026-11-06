export type Env = {
  DATABASE_URL: string
  PUBLIC_BASE_URL: string
  BETTER_AUTH_SECRET: string
  ADMIN_EMAIL: string
  PORT: number
  AH_SIDECAR_URL: string
  AH_SIDECAR_SECRET: string
}

export declare class EnvError extends Error {
  readonly issues: string[]
  constructor(issues: string[])
}

export declare function parseEnv(source: Record<string, string | undefined>): Env
