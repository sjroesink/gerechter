import { describe, expect, test } from 'vitest'
import { Invalid } from '~/domain/core'
import {
  createSafeFetch,
  guardedLookup,
  isPublicAddress,
  validateOutboundUrl,
  type OutboundFetcher,
} from './safe-fetch'

const options = { maxBytes: 100, accept: 'text/html' }

describe('veilige uitgaande verzoeken', () => {
  test.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.5',
    '192.168.1.10',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::ffff:127.0.0.1',
    'fd00::1',
    'fe80::1',
    '64:ff9b::7f00:1',
  ])('%s is niet publiek', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })

  test('publieke adressen zijn toegestaan', () => {
    expect(isPublicAddress('93.184.215.14')).toBe(true)
    expect(isPublicAddress('2606:4700::6810:84e5')).toBe(true)
  })

  test.each([
    'ftp://example.com/recept',
    'http://user:geheim@example.com/',
    'http://example.com:8080/',
    'http://localhost/',
    'http://printer.local/',
    'http://127.0.0.1/',
    'http://[::1]/',
    'http://169.254.169.254/latest/meta-data',
    'geen url',
  ])('weigert %s', (url) => {
    expect(() => validateOutboundUrl(url)).toThrow(Invalid)
  })

  test('de DNS-controle weigert namen die naar een intern adres wijzen', async () => {
    const error = await new Promise<Error | null>((resolve) =>
      guardedLookup('localhost', { all: true }, (err) => resolve(err)),
    )
    expect(error?.message).toContain('niet publiek')
  })

  test('volgt redirects, maar controleert elk doel opnieuw', async () => {
    const visited: string[] = []
    const fetcher: OutboundFetcher = async (url) => {
      visited.push(url)
      if (url === 'https://example.com/a')
        return new Response(null, { status: 301, headers: { location: '/b' } })
      if (url === 'https://example.com/b')
        return new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } })
      return new Response('intern')
    }
    await expect(createSafeFetch(fetcher)('https://example.com/a', options)).rejects.toThrow(
      'niet toegestaan',
    )
    expect(visited).toEqual(['https://example.com/a', 'https://example.com/b'])
  })

  test('geeft de uiteindelijke URL, het type en de charset terug', async () => {
    const fetcher: OutboundFetcher = async (url) =>
      url.endsWith('/oud')
        ? new Response(null, { status: 308, headers: { location: 'https://example.com/nieuw' } })
        : new Response('<p>hoi</p>', { headers: { 'content-type': 'text/html; charset=ISO-8859-1' } })
    const result = await createSafeFetch(fetcher)('https://example.com/oud', options)
    expect(result).toMatchObject({
      finalUrl: 'https://example.com/nieuw',
      contentType: 'text/html',
      charset: 'iso-8859-1',
    })
    expect(new TextDecoder().decode(result.bytes)).toBe('<p>hoi</p>')
  })

  test('begrenst redirects, grootte, status en duur', async () => {
    const loop: OutboundFetcher = async (url) =>
      new Response(null, { status: 302, headers: { location: `${url}x` } })
    await expect(createSafeFetch(loop)('https://example.com/', options)).rejects.toThrow('te vaak')

    const declared: OutboundFetcher = async () => new Response('x', { headers: { 'content-length': '5000' } })
    await expect(createSafeFetch(declared)('https://example.com/', options)).rejects.toThrow('groter')

    const streamed: OutboundFetcher = async () => new Response('x'.repeat(500))
    await expect(createSafeFetch(streamed)('https://example.com/', options)).rejects.toThrow('groter')

    const missing: OutboundFetcher = async () => new Response('weg', { status: 404 })
    await expect(createSafeFetch(missing)('https://example.com/', options)).rejects.toThrow('404')

    const slow: OutboundFetcher = (_url, init) =>
      new Promise((_resolve, reject) =>
        init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }),
      )
    await expect(
      createSafeFetch(slow)('https://example.com/', { ...options, timeoutMs: 20 }),
    ).rejects.toThrow('te lang')
  })

  test('stuurt een opgegeven referer mee', async () => {
    let headers: Record<string, string> = {}
    const fetcher: OutboundFetcher = async (_url, init) => {
      headers = init.headers
      return new Response('ok')
    }
    await createSafeFetch(fetcher)('https://cdn.example.com/a.jpg', {
      ...options,
      referer: 'https://example.com/recept',
    })
    expect(headers.referer).toBe('https://example.com/recept')
  })
})
