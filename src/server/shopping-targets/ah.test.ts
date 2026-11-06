import { describe, expect, test, vi } from 'vitest'
import type { ShoppingProviderRequest } from '~/domain/shopping-target'
import { AH_AUTHORIZATION_URL, ahSidecar } from './ah'

const config = { url: 'http://sidecar.internal:8000/', secret: 'fictief-servergeheim-met-minstens-32-tekens' }
const reference = { connectionId: crypto.randomUUID(), connectionKey: 'k'.repeat(43) }
function fixture(): ShoppingProviderRequest {
  const source = { kind: 'recipe' as const, recipeId: crypto.randomUUID(), servings: 2 }
  return {
    runId: crypto.randomUUID(),
    connection: { destinationId: reference.connectionId, secret: reference.connectionKey },
    needs: {
      source,
      title: 'Testsoep',
      sourceKeys: ['recipe:test'],
      sources: [],
      items: [],
      staples: [],
      covered: [],
      ignored: [],
      lines: ['300 g · Tomaten'],
      text: '300 g · Tomaten',
      fingerprint: 'a'.repeat(64),
    },
  }
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const job = (input: ShoppingProviderRequest, status = 'pending', extra = {}) => ({
  export_id: input.runId,
  status,
  completed: 0,
  total: 1,
  ...extra,
})

describe('AH-sidecarcontract', () => {
  test('leest gecontroleerde aanmeldinformatie en wisselt een code afgeschermd uit', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ experimental: true, authorization_url: AH_AUTHORIZATION_URL }))
      .mockResolvedValueOnce(
        json({ connection_id: reference.connectionId, connection_key: reference.connectionKey }),
      )
    const client = ahSidecar(config, fetcher)
    expect(await client.info()).toEqual({ experimental: true, authorizationUrl: AH_AUTHORIZATION_URL })
    const household = crypto.randomUUID()
    expect(await client.connect(household, 'fictieve-code')).toEqual(reference)
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://sidecar.internal:8000/auth-info')
    const [, options] = fetcher.mock.calls[1]!
    expect(options).toMatchObject({ method: 'POST', redirect: 'error' })
    expect(new Headers(options?.headers).get('authorization')).toBe(`Bearer ${config.secret}`)
    expect(JSON.parse(String(options?.body))).toEqual({ household_id: household, code: 'fictieve-code' })
  })

  test('weigert vreemde aanmeld-URLs en toont geen ruwe aanmeldfouten', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ experimental: true, authorization_url: 'https://vreemd.test/login' }))
      .mockResolvedValueOnce(json({ token: config.secret }, 401))
    const client = ahSidecar(config, fetcher)
    await expect(client.info()).rejects.toThrow(/geen geldige/)
    try {
      await client.connect(crypto.randomUUID(), 'code')
    } catch (error) {
      expect(String(error)).toContain('AH-aanmelding niet gelukt')
      expect(String(error)).not.toContain(config.secret)
    }
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  test('start één duurzame job met aparte sleutel en leest de voortgang zonder nieuwe write', async () => {
    const input = fixture()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(job(input), 202))
      .mockResolvedValueOnce(json(job(input, 'succeeded', { completed: 1 })))
    const target = ahSidecar(config, fetcher).target
    expect(await target.send(input)).toMatchObject({
      status: 'pending',
      externalId: input.runId,
      message: expect.stringContaining('0 van 1'),
    })
    expect(await target.check(input)).toMatchObject({
      status: 'succeeded',
      message: expect.stringContaining('1 van 1'),
    })
    expect(fetcher.mock.calls.map(([, options]) => options?.method)).toEqual(['POST', 'GET'])
    const [url, options] = fetcher.mock.calls[0]!
    expect(url).toBe(`http://sidecar.internal:8000/connections/${reference.connectionId}/exports`)
    expect(new Headers(options?.headers).get('X-Connection-Key')).toBe(reference.connectionKey)
    expect(JSON.parse(String(options?.body))).toEqual({ export_id: input.runId, lines: input.needs.lines })
    expect(String(url)).not.toContain(reference.connectionKey)
  })

  test('herhaalt transportfouten en onzekere antwoorden nooit automatisch', async () => {
    const input = fixture()
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(json({}, 500))
      .mockResolvedValueOnce(json(job(input, 'succeeded', { export_id: crypto.randomUUID() })))
      .mockResolvedValueOnce(json(job(input, 'succeeded', { completed: 2 })))
    const target = ahSidecar(config, fetcher).target
    for (let i = 0; i < 4; i++) expect((await target.send(input)).status).toBe('uncertain')
    expect(fetcher).toHaveBeenCalledTimes(4)
  })

  test('een afwijzing is definitief en de foutbody blijft privé', async () => {
    const input = fixture(),
      fetcher = vi.fn<typeof fetch>(async () => json({ detail: reference.connectionKey }, 401))
    const result = await ahSidecar(config, fetcher).target.send(input)
    expect(result.status).toBe('failed')
    expect(JSON.stringify(result)).not.toContain(reference.connectionKey)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  test('alleen een gecontroleerd afwezige job staat bewuste herhaling toe', async () => {
    const input = fixture(),
      fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(json({ detail: { code: 'connection_not_found' } }, 404))
        .mockResolvedValueOnce(json({ detail: { code: 'export_not_found' } }, 404))
        .mockResolvedValueOnce(json(job(input, 'uncertain', { verified_absent: true })))
    const target = ahSidecar(config, fetcher).target
    expect((await target.check(input)).verifiedAbsent).not.toBe(true)
    expect(await target.check(input)).toMatchObject({ status: 'uncertain', verifiedAbsent: true })
    expect(await target.check(input)).toMatchObject({ status: 'uncertain', verifiedAbsent: true })
    expect(fetcher.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true)
  })

  test('weigert ongeldige lijsten vóór IO en wist een verbinding met DELETE', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ disconnected: true })),
      client = ahSidecar(config, fetcher),
      input = fixture()
    input.needs.lines = ['x'.repeat(2001)]
    expect((await client.target.send(input)).status).toBe('failed')
    expect(fetcher).not.toHaveBeenCalled()
    expect(await client.disconnect(reference)).toBe(true)
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('DELETE')
  })
})
