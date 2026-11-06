import { z } from 'zod'

const webUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value)
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
    } catch {
      return false
    }
  }, 'Gebruik een http- of https-URL zonder aanmeldgegevens.')

export const ingredientPhotoInput = z
  .object({
    url: webUrl,
    sourceUrl: webUrl.nullable().default(null),
    credit: z.string().trim().min(1).max(300).nullable().default(null),
    licenseUrl: webUrl.nullable().default(null),
  })
  .strict()
export type IngredientPhoto = z.output<typeof ingredientPhotoInput>
