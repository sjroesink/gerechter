export declare const REQUIRED_ENV: string[]
export declare function startServer(options?: {
  env?: Record<string, string | undefined>
  folder?: string
  importServer?: () => Promise<unknown>
}): Promise<unknown>
