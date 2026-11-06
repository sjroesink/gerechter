/**
 * Leest een receptpagina uit tot een concept voor de agent. Eerst schema.org/Recipe als JSON-LD;
 * zonder JSON-LD volgt de paginatekst zodat de agent het recept zelf kan uitlezen.
 * Puur: geen netwerk of database.
 */

export type RecipeDraftStep = { section: string | null; text: string }

export type RecipeDraft = {
  structured: boolean
  name: string | null
  description: string
  servings: number | null
  prepMinutes: number | null
  cookMinutes: number | null
  totalMinutes: number | null
  ingredientLines: string[]
  steps: RecipeDraftStep[]
  imageUrl: string | null
  suggestedTags: string[]
  pageText?: string
}

const MAX_PAGE_TEXT = 20_000
const MAX_LINES = 200

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  aacute: 'á',
  agrave: 'à',
  acirc: 'â',
  auml: 'ä',
  iacute: 'í',
  iuml: 'ï',
  icirc: 'î',
  oacute: 'ó',
  ouml: 'ö',
  ocirc: 'ô',
  uacute: 'ú',
  uuml: 'ü',
  ccedil: 'ç',
  ntilde: 'ñ',
  szlig: 'ß',
  deg: '°',
  frac12: '½',
  frac14: '¼',
  frac34: '¾',
  times: '×',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  euro: '€',
}

function decodeOnce(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match
  })
}

/** Decodeert entities; sommige sites coderen dubbel (&amp;amp;). */
export function decodeEntities(value: string) {
  const once = decodeOnce(value)
  return /&(#x?[0-9a-f]+|[a-z]+);/i.test(once) ? decodeOnce(once) : once
}

function clean(value: unknown, max = 4000): string {
  if (typeof value === 'number') return String(value)
  if (typeof value !== 'string') return ''
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function asArray(value: Json | undefined): Json[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasType(node: JsonObject, type: string) {
  return asArray(node['@type']).some(
    (value) =>
      typeof value === 'string' && value.replace(/^.*[/:#]/, '').toLowerCase() === type.toLowerCase(),
  )
}

/** Veel sites zetten ruwe regelovergangen in JSON-strings; die maken JSON ongeldig. Escape ze alleen binnen strings. */
function escapeControlCharsInStrings(text: string) {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (inString && char === '\\') {
      out += char + (text[i + 1] ?? '')
      i++
    } else if (char === '"') {
      inString = !inString
      out += char
    } else if (inString && char.charCodeAt(0) < 0x20) {
      out += char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : ' '
    } else {
      out += char
    }
  }
  return out
}

function parseJsonLd(text: string): Json | undefined {
  const body = text
    .trim()
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/^<!--|-->$/g, '')
    .trim()
  for (const candidate of [body, escapeControlCharsInStrings(body)]) {
    try {
      return JSON.parse(candidate) as Json
    } catch {
      // volgende poging
    }
  }
  return undefined
}

function findRecipe(node: Json | undefined, depth = 0): JsonObject | null {
  if (depth > 8 || node === undefined || node === null) return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipe(item, depth + 1)
      if (found) return found
    }
    return null
  }
  if (!isObject(node)) return null
  if (hasType(node, 'Recipe')) return node
  for (const value of Object.values(node)) {
    const found = findRecipe(value, depth + 1)
    if (found) return found
  }
  return null
}

function jsonLdRecipe(html: string): JsonObject | null {
  const scripts = html.matchAll(
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi,
  )
  for (const [, text] of scripts) {
    const found = findRecipe(parseJsonLd(text ?? ''))
    if (found) return found
  }
  return null
}

function metaContent(html: string, key: string): string | null {
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = Object.fromEntries(
      [...tag.matchAll(/([a-z:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((match) => [
        match[1]!.toLowerCase(),
        match[3] ?? match[4] ?? match[5] ?? '',
      ]),
    )
    if ((attrs.property ?? attrs.name)?.toLowerCase() === key && attrs.content) return clean(attrs.content)
  }
  return null
}

function absoluteHttpUrl(value: unknown, base: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(decodeEntities(value.trim()), base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function imageUrl(value: Json | undefined, base: string): string | null {
  for (const item of asArray(value)) {
    const candidate = isObject(item) ? (item.url ?? item.contentUrl) : item
    const url = absoluteHttpUrl(Array.isArray(candidate) ? candidate[0] : candidate, base)
    if (url) return url
  }
  return null
}

/** ISO-8601-duur (PT1H30M, P0DT0H45M) naar hele minuten; ongeldig of nul wordt null. */
export function durationMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = value
    .trim()
    .match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i)
  if (!match) return null
  const [, days, hours, minutes, seconds] = match.map((part) => Number(part ?? 0))
  const total = Math.round(days! * 1440 + hours! * 60 + minutes! + seconds! / 60)
  return total > 0 && total <= 10080 ? total : null
}

function servings(value: Json | undefined): number | null {
  for (const item of asArray(value)) {
    const match = String(typeof item === 'object' ? '' : item).match(/\d+/)
    const count = match ? Number(match[0]) : NaN
    if (Number.isInteger(count) && count >= 1 && count <= 1000) return count
  }
  return null
}

function collectSteps(value: Json | undefined, section: string | null, out: RecipeDraftStep[]) {
  for (const item of asArray(value)) {
    if (out.length >= MAX_LINES) return
    if (typeof item === 'string') {
      for (const line of decodeEntities(item).split(/\r?\n|<br\s*\/?>|<\/p>|<\/li>/i)) {
        const text = clean(line)
        if (text) out.push({ section, text })
      }
    } else if (isObject(item)) {
      if (hasType(item, 'HowToSection')) {
        collectSteps(item.itemListElement, clean(item.name) || section, out)
      } else if (item.itemListElement && !item.text) {
        collectSteps(item.itemListElement, section, out)
      } else {
        const text = clean(item.text ?? item.name)
        if (text) out.push({ section, text })
      }
    }
  }
}

function tags(recipe: JsonObject): string[] {
  const values = [recipe.keywords, recipe.recipeCategory, recipe.recipeCuisine].flatMap((value) =>
    asArray(value).flatMap((item) => (typeof item === 'string' ? item.split(',') : [])),
  )
  const seen = new Set<string>()
  for (const value of values) {
    const tag = clean(value, 60).toLowerCase()
    if (tag) seen.add(tag)
  }
  return [...seen].slice(0, 10)
}

/** Zichtbare tekst van de pagina, zonder scripts, stijlen en opmaak, met regelovergangen per blok. */
export function pageText(html: string): string {
  const body = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
  const text = body
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|header|form)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/div|\/tr|\/section|\/article|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, MAX_PAGE_TEXT)
}

export function extractRecipe(html: string, pageUrl: string): RecipeDraft {
  const ogImage = absoluteHttpUrl(metaContent(html, 'og:image'), pageUrl)
  const title =
    metaContent(html, 'og:title') ?? (clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]) || null)
  const recipe = jsonLdRecipe(html)
  if (!recipe) {
    return {
      structured: false,
      name: title,
      description: metaContent(html, 'og:description') ?? metaContent(html, 'description') ?? '',
      servings: null,
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      ingredientLines: [],
      steps: [],
      imageUrl: ogImage,
      suggestedTags: [],
      pageText: pageText(html),
    }
  }
  const steps: RecipeDraftStep[] = []
  collectSteps(recipe.recipeInstructions, null, steps)
  return {
    structured: true,
    name: clean(recipe.name, 160) || title,
    description: clean(recipe.description, 5000),
    servings: servings(recipe.recipeYield ?? recipe.yield),
    prepMinutes: durationMinutes(recipe.prepTime),
    cookMinutes: durationMinutes(recipe.cookTime),
    totalMinutes: durationMinutes(recipe.totalTime),
    ingredientLines: asArray(recipe.recipeIngredient ?? recipe.ingredients)
      .map((line) => clean(line, 500))
      .filter(Boolean)
      .slice(0, MAX_LINES),
    steps,
    imageUrl: imageUrl(recipe.image, pageUrl) ?? ogImage,
    suggestedTags: tags(recipe),
  }
}
