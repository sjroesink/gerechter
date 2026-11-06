import { z } from 'zod'
import { Invalid, type Ctx } from '~/domain/core'
import { MAX_IMAGE_BYTES, type FetchImage } from '~/domain/images'
import { findRecipeBySourceUrl } from '~/domain/recipes'
import { parseInput } from '~/domain/core/validation'
import { createSafeFetch, type SafeFetch } from '../safe-fetch'
import { extractRecipe } from './extract'

const MAX_PAGE_BYTES = 3 * 1024 * 1024

export type FetchPage = (url: string) => Promise<{ finalUrl: string; html: string }>
export type RecipeImportDeps = { fetchPage: FetchPage; fetchImage: FetchImage }

function decode(bytes: Uint8Array, charset: string | null) {
  try {
    return new TextDecoder(charset ?? 'utf-8').decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

/** Pagina's en afbeeldingen via dezelfde veilige fetch; tests geven een eigen SafeFetch mee. */
export function createRecipeImportDeps(safeFetch: SafeFetch = createSafeFetch()): RecipeImportDeps {
  return {
    async fetchPage(url) {
      const page = await safeFetch(url, {
        maxBytes: MAX_PAGE_BYTES,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
      })
      if (page.contentType && !/html|xml/.test(page.contentType))
        throw new Invalid('De URL verwijst niet naar een webpagina.')
      return { finalUrl: page.finalUrl, html: decode(page.bytes, page.charset) }
    },
    async fetchImage(url, options) {
      const result = await safeFetch(url, {
        maxBytes: MAX_IMAGE_BYTES,
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1',
        referer: options?.referer,
      })
      return { bytes: result.bytes, finalUrl: result.finalUrl }
    },
  }
}

export const fetchRecipeInput = z
  .object({ url: z.string().trim().url('Vul een geldige URL in.').max(2000) })
  .strict()

/** Leest een recept-URL uit tot een concept; slaat niets op. */
export async function fetchRecipeFromUrl(
  ctx: Ctx,
  deps: Pick<RecipeImportDeps, 'fetchPage'>,
  input: z.input<typeof fetchRecipeInput>,
) {
  const { url } = parseInput(fetchRecipeInput, input)
  const page = await deps.fetchPage(url)
  const draft = extractRecipe(page.html, page.finalUrl)
  return {
    sourceUrl: page.finalUrl,
    existingRecipe: await findRecipeBySourceUrl(ctx, [url, page.finalUrl]),
    ...draft,
  }
}
