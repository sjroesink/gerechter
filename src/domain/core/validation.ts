import type { ZodType } from 'zod'
import { Invalid } from './errors'

export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new Invalid(result.error.issues.map((issue) => issue.message).join(' '))
  return result.data
}
