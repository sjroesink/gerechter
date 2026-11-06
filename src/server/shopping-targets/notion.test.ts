import { describe, expect, test, vi } from 'vitest'
import type { ShoppingProviderRequest } from '~/domain/shopping-target'
import { buildNotionPage, notionTarget } from './notion'

function fixture(count = 1): ShoppingProviderRequest {
  const source = { kind: 'recipe' as const, recipeId: crypto.randomUUID(), servings: 2 }
  return {
    runId: crypto.randomUUID(),
    connection: { destinationId: crypto.randomUUID(), secret: 'ntn_fictief-geheim' },
    needs: {
      source,
      title: 'Tomatensoep · 2 porties',
      sourceKeys: [`recipe:${source.recipeId}`],
      sources: [],
      items: [],
      staples: [],
      covered: [],
      ignored: [],
      lines: Array.from({ length: count }, (_, i) => `${i + 1} g · Tomaten`),
      text: 'Boodschappen',
      fingerprint: 'a'.repeat(64),
    },
  }
}
const json = (body: unknown, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
const page = (input: ShoppingProviderRequest, id = crypto.randomUUID()) => ({
  object: 'page',
  id,
  url: `https://app.notion.com/p/${id}`,
  parent: { page_id: input.connection!.destinationId },
})

describe('Notion ShoppingTarget-contract', () => {
  test('maakt één checklistpagina onder de ingestelde ouder met versieheader en unieke marker', async () => {
    const input = fixture()
    input.needs.lines = ['300 g · Tomaten <script>literal</script>']
    const fetcher = vi.fn<typeof fetch>(async () => json(page(input)))
    const result = await notionTarget(fetcher).send(input)
    expect(result.status).toBe('succeeded')
    expect(fetcher).toHaveBeenCalledTimes(1)
    const [url, options] = fetcher.mock.calls[0]!
    expect(url).toBe('https://api.notion.com/v1/pages')
    expect(options).toMatchObject({ method: 'POST', redirect: 'error' })
    expect(new Headers(options?.headers).get('Notion-Version')).toBe('2026-03-11')
    expect(new Headers(options?.headers).get('authorization')).toBe(`Bearer ${input.connection!.secret}`)
    const body = JSON.parse(String(options?.body))
    expect(body.parent).toEqual({ type: 'page_id', page_id: input.connection!.destinationId })
    expect(body.properties.title.title[0].text.content).toContain(`[Gerechter:${input.runId}]`)
    expect(body.children[1]).toEqual({
      object: 'block',
      type: 'to_do',
      to_do: { checked: false, rich_text: [{ type: 'text', text: { content: input.needs.lines[0] } }] },
    })
    expect(body.notifications).toEqual({ mode: 'silent' })
    expect(JSON.stringify(body)).not.toContain(input.connection!.secret)
    expect(JSON.stringify(result)).not.toContain(input.connection!.secret)
  })

  test('groepeert langere checklists met maximaal 100 kinderen per array', () => {
    const body = buildNotionPage(fixture(201))
    expect(body.children).toHaveLength(4)
    const groups = body.children.slice(1) as { toggle: { children: unknown[] } }[]
    expect(groups.map((group) => group.toggle.children.length)).toEqual([100, 100, 1])
  })

  test('weigert te veel blokken, te lange regels en te grote payload vóór externe IO', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const target = notionTarget(fetcher)
    for (const input of [
      fixture(1000),
      { ...fixture(), needs: { ...fixture().needs, lines: ['x'.repeat(2001)] } },
      {
        ...fixture(),
        needs: { ...fixture().needs, lines: Array.from({ length: 300 }, () => 'x'.repeat(1800)) },
      },
    ])
      expect((await target.send(input)).status).toBe('failed')
    expect(fetcher).not.toHaveBeenCalled()
  })

  test('definitieve afwijzingen en rate limits herhalen geen write en lekken geen ruwe foutbody', async () => {
    const input = fixture()
    const fetcher = vi.fn<typeof fetch>(async () =>
      json({ message: `fout ${input.connection!.secret}` }, 401),
    )
    const denied = await notionTarget(fetcher).send(input)
    expect(denied).toMatchObject({ status: 'failed', message: expect.stringContaining('HTTP 401') })
    expect(JSON.stringify(denied)).not.toContain(input.connection!.secret)
    expect(fetcher).toHaveBeenCalledTimes(1)
    fetcher.mockResolvedValueOnce(json({}, 429, { 'retry-after': '15' }))
    const limited = await notionTarget(fetcher).send(input)
    expect(limited).toMatchObject({ status: 'failed', message: expect.stringContaining('15 seconden') })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test('transportfouten, 5xx en onbruikbare succesdata blijven onzeker zonder schrijfretry', async () => {
    const input = fixture()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('socket dicht'))
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json({ object: 'page', id: 'geen-id' }))
    const target = notionTarget(fetcher)
    for (let i = 0; i < 3; i++) expect((await target.send(input)).status).toBe('uncertain')
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'POST')).toBe(true)
  })

  test('503 met committed_resource_id wordt met GET bevestigd zonder tweede POST', async () => {
    const input = fixture(),
      committed = crypto.randomUUID()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        json(
          {
            additional_data: {
              committed_resource_id: committed,
              retry_guidance: ['Do not repeat the write.'],
            },
          },
          503,
        ),
      )
      .mockResolvedValueOnce(json(page(input, committed)))
    const result = await notionTarget(fetcher).send(input)
    expect(result).toMatchObject({ status: 'succeeded', externalId: committed })
    expect(fetcher.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET'])
    expect(fetcher.mock.calls[1]?.[0]).toBe(`https://api.notion.com/v1/pages/${committed}`)
  })

  test('mislukte GET na 503 behoudt de bekende externe ID voor latere controle', async () => {
    const input = fixture(),
      committed = crypto.randomUUID()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ additional_data: { committed_resource_id: committed } }, 503))
      .mockRejectedValueOnce(new Error('read niet bereikbaar'))
    expect(await notionTarget(fetcher).send(input)).toMatchObject({
      status: 'uncertain',
      externalId: committed,
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test('statuscontrole zoekt gepagineerd met een ongewijzigde opaque cursor en leest de gevonden pagina', async () => {
    const input = fixture(),
      found = crypto.randomUUID(),
      cursor = 'opaque + / ? cursor'
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ results: [], has_more: true, next_cursor: cursor }))
      .mockResolvedValueOnce(
        json({
          results: [
            {
              id: found,
              type: 'child_page',
              child_page: { title: `Boodschappen [Gerechter:${input.runId}]` },
            },
          ],
          has_more: false,
          next_cursor: null,
        }),
      )
      .mockResolvedValueOnce(json(page(input, found)))
    const result = await notionTarget(fetcher).check!(input)
    expect(result).toMatchObject({ status: 'succeeded', externalId: found })
    const secondUrl = new URL(String(fetcher.mock.calls[1]?.[0]))
    expect(secondUrl.searchParams.get('start_cursor')).toBe(cursor)
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true)
  })

  test('alleen een volledig gelezen afwezige export wordt als gecontroleerd afwezig gemeld', async () => {
    const input = fixture()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ results: [], has_more: false, next_cursor: null }))
      .mockResolvedValueOnce(json({}, 403))
    const target = notionTarget(fetcher)
    expect(await target.check!(input)).toMatchObject({ status: 'uncertain', verifiedAbsent: true })
    expect((await target.check!(input)).verifiedAbsent).not.toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test('onbruikbare paginering en een pagina onder een ander doel worden niet als bevestigd behandeld', async () => {
    const input = fixture(),
      found = crypto.randomUUID()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ results: [], has_more: true, next_cursor: null }))
      .mockResolvedValueOnce(
        json({
          results: [{ id: found, type: 'child_page', child_page: { title: `[Gerechter:${input.runId}]` } }],
          has_more: false,
          next_cursor: null,
        }),
      )
      .mockResolvedValueOnce(json({ ...page(input, found), parent: { page_id: crypto.randomUUID() } }))
    const target = notionTarget(fetcher)
    expect((await target.check!(input)).verifiedAbsent).not.toBe(true)
    expect((await target.check!(input)).status).toBe('uncertain')
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true)
  })
})
