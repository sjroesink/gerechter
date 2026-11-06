import { z } from 'zod'
import type {
  ShoppingProviderRequest,
  ShoppingProviderResult,
  ShoppingTarget,
} from '~/domain/shopping-target'

const VERSION = '2026-03-11'
const API = 'https://api.notion.com/v1'
const uuid = z.string().uuid()
const pageResult = z.object({
  object: z.literal('page'),
  id: uuid,
  url: z
    .string()
    .url()
    .max(2000)
    .refine((value) => value.startsWith('https://')),
  in_trash: z.boolean().optional(),
  parent: z.object({ page_id: uuid.optional() }).optional(),
})
const childrenResult = z.object({
  results: z.array(
    z.object({
      id: uuid,
      type: z.string(),
      child_page: z.object({ title: z.string() }).optional(),
      in_trash: z.boolean().optional(),
    }),
  ),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
})
const marker = (runId: string) => `[Gerechter:${runId}]`
const richText = (content: string) => [{ type: 'text', text: { content } }]
const unknown = (externalId?: string): ShoppingProviderResult => ({
  status: 'uncertain',
  externalId,
  message:
    'Het Notion-resultaat is onzeker. Controleer de status; er wordt niet automatisch opnieuw verzonden.',
})

export function buildNotionPage(request: ShoppingProviderRequest) {
  if (
    !request.connection ||
    !uuid.safeParse(request.connection.destinationId).success ||
    !uuid.safeParse(request.runId).success
  )
    throw new Error('Ongeldige Notion-verbinding')
  const todos = request.needs.lines.map((line) => {
    if (line.length > 2000) throw new Error('Een boodschappenregel is te lang voor Notion')
    return { object: 'block', type: 'to_do', to_do: { rich_text: richText(line), checked: false } }
  })
  const children: object[] = [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: richText(
          'Boodschappen uit Gerechter. Regels met onbekende hoeveelheden of omrekeningen moet je zelf controleren.',
        ),
      },
    },
  ]
  if (todos.length <= 99) children.push(...todos)
  else
    for (let offset = 0; offset < todos.length; offset += 100)
      children.push({
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: richText(`Boodschappen ${offset + 1}–${Math.min(offset + 100, todos.length)}`),
          children: todos.slice(offset, offset + 100),
        },
      })
  const blockCount = todos.length + children.length - (todos.length <= 99 ? todos.length : 0)
  if (children.length > 100 || blockCount > 1000)
    throw new Error('Te veel boodschappenregels voor één Notion-export')
  const body = {
    parent: { type: 'page_id', page_id: request.connection.destinationId },
    properties: {
      title: {
        type: 'title',
        title: richText(`Boodschappen · ${request.needs.title.slice(0, 1500)} ${marker(request.runId)}`),
      },
    },
    children,
    notifications: { mode: 'silent' },
  }
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > 500_000)
    throw new Error('De Notion-export is te groot')
  return body
}

export function notionTarget(fetcher: typeof fetch = fetch): ShoppingTarget {
  async function request(input: ShoppingProviderRequest, path: string, method = 'GET', body?: object) {
    return fetcher(`${API}${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
      headers: {
        authorization: `Bearer ${input.connection!.secret}`,
        'Notion-Version': VERSION,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  }
  async function readPage(input: ShoppingProviderRequest, pageId: string): Promise<ShoppingProviderResult> {
    if (!uuid.safeParse(pageId).success) return unknown()
    try {
      const response = await request(input, `/pages/${encodeURIComponent(pageId)}`)
      if (!response.ok) return unknown(pageId)
      const parsed = pageResult.safeParse(await response.json())
      if (
        !parsed.success ||
        parsed.data.in_trash ||
        (parsed.data.parent?.page_id &&
          parsed.data.parent.page_id.toLowerCase() !== input.connection!.destinationId.toLowerCase())
      )
        return unknown(pageId)
      return {
        status: 'succeeded',
        externalId: parsed.data.id,
        externalUrl: parsed.data.url,
        message: 'Notion-checklist gevonden.',
      }
    } catch {
      return unknown(pageId)
    }
  }
  return {
    async send(input) {
      let body: object
      try {
        body = buildNotionPage(input)
      } catch {
        return {
          status: 'failed',
          message:
            'Deze lijst of verbinding past niet binnen de Notion-limieten. Controleer de pagina-ID of exporteer een kleinere selectie.',
        }
      }
      try {
        const response = await request(input, '/pages', 'POST', body)
        if (response.ok) {
          const page = pageResult.safeParse(await response.json())
          if (!page.success || page.data.in_trash) return unknown()
          return {
            status: 'succeeded',
            externalId: page.data.id,
            externalUrl: page.data.url,
            message: 'Checklist in Notion aangemaakt.',
          }
        }
        if (response.status >= 400 && response.status < 500 && response.status !== 408) {
          const delay = Number(response.headers.get('retry-after'))
          return {
            status: 'failed',
            message:
              response.status === 429
                ? `Notion vraagt om later opnieuw te proberen${Number.isFinite(delay) && delay > 0 ? ` (na ${Math.ceil(delay)} seconden)` : ''}. Er is niets opnieuw verstuurd.`
                : `Notion heeft de export geweigerd (HTTP ${response.status}). Controleer token, pagina-ID en lees-/schrijfrechten.`,
          }
        }
        if (response.status === 503) {
          const error = z
            .object({ additional_data: z.object({ committed_resource_id: uuid }).optional() })
            .safeParse(await response.json().catch(() => null))
          const committed = error.success ? error.data.additional_data?.committed_resource_id : undefined
          if (committed) return readPage(input, committed)
        }
        return unknown()
      } catch {
        return unknown()
      }
    },
    async check(input) {
      if (!input.connection) return unknown()
      if (input.externalId) {
        const result = await readPage(input, input.externalId)
        if (result.status === 'succeeded') return result
      }
      try {
        let cursor: string | undefined
        const seen = new Set<string>()
        for (let page = 0; page < 100; page++) {
          const query = new URLSearchParams({ page_size: '100' })
          if (cursor) query.set('start_cursor', cursor)
          const response = await request(
            input,
            `/blocks/${encodeURIComponent(input.connection.destinationId)}/children?${query}`,
          )
          if (!response.ok) return unknown(input.externalId ?? undefined)
          const result = childrenResult.safeParse(await response.json())
          if (!result.success) return unknown(input.externalId ?? undefined)
          const match = result.data.results.find(
            (block) =>
              block.type === 'child_page' &&
              !block.in_trash &&
              block.child_page?.title.includes(marker(input.runId)),
          )
          if (match) return readPage(input, match.id)
          if (!result.data.has_more)
            return {
              status: 'uncertain',
              verifiedAbsent: true,
              message:
                'Geen bestaande export gevonden. Controleer het doel voordat je bewust opnieuw exporteert.',
            }
          const next = result.data.next_cursor
          if (!next || seen.has(next)) return unknown()
          seen.add(next)
          cursor = next
        }
        return unknown()
      } catch {
        return unknown(input.externalId ?? undefined)
      }
    },
  }
}
