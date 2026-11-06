import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import { BlockList, isIP } from 'node:net'
import { Agent, fetch as undiciFetch } from 'undici'
import { Invalid } from '~/domain/core'

/**
 * Uitgaande verzoeken naar door gebruikers of agents opgegeven URL's (receptimport).
 * Alleen publieke adressen: het opgeloste IP wordt bij elke verbinding gecontroleerd, dus ook na
 * redirects en bij DNS-rebinding. Daarnaast grenzen aan redirects, duur en grootte.
 */

const blocked = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  blocked.addSubnet(network, prefix, 'ipv4')
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['64:ff9b:1::', 48],
  ['100::', 64],
  ['2001::', 23],
  ['2001:db8::', 32],
  ['2002::', 16],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const)
  blocked.addSubnet(network, prefix, 'ipv6')

/**
 * Alleen adressen op het publieke internet. BlockList toetst IPv4-mapped IPv6 (::ffff:a.b.c.d) zelf aan de
 * IPv4-regels; NAT64-prefixen tellen als niet-publiek.
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

class BlockedAddress extends Error {
  code = 'EGERECHTER_BLOCKED'
  constructor(host: string) {
    super(`Adres van ${host} is niet publiek`)
  }
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void

/** dns.lookup met controle op publieke adressen; wordt door net/tls bij elke verbinding aangeroepen. */
export function guardedLookup(hostname: string, options: LookupOptions, callback: LookupCallback) {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, [])
    if (addresses.length === 0 || addresses.some((item) => !isPublicAddress(item.address)))
      return callback(new BlockedAddress(hostname), [])
    if (options.all) return callback(null, addresses)
    const first = addresses[0]!
    callback(null, first.address, first.family)
  })
}

/** Controleert schema, poort, inloggegevens en IP-letterlijke hosts (die slaan de DNS-lookup over). */
export function validateOutboundUrl(value: string | URL): URL {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Invalid('Vul een geldige URL in.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Invalid('Gebruik een http- of https-URL.')
  if (url.username || url.password) throw new Invalid('Een URL met inloggegevens is niet toegestaan.')
  if (url.port && url.port !== '80' && url.port !== '443')
    throw new Invalid('Alleen de standaardpoorten 80 en 443 zijn toegestaan.')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local'))
    throw new Invalid('Dit adres is niet toegestaan.')
  if (isIP(host) && !isPublicAddress(host)) throw new Invalid('Dit adres is niet toegestaan.')
  return url
}

export type OutboundFetcher = (
  url: string,
  init: { redirect: 'manual'; signal: AbortSignal; headers: Record<string, string> },
) => Promise<Response>

let agent: Agent | undefined
const publicOnlyFetcher: OutboundFetcher = async (url, init) => {
  agent ??= new Agent({ connect: { lookup: guardedLookup as never }, connections: 8 })
  return (await undiciFetch(url, { ...init, dispatcher: agent })) as unknown as Response
}

export type SafeFetchResult = {
  finalUrl: string
  contentType: string
  charset: string | null
  bytes: Uint8Array
}
export type SafeFetchOptions = { maxBytes: number; accept: string; referer?: string; timeoutMs?: number }
export type SafeFetch = (url: string, options: SafeFetchOptions) => Promise<SafeFetchResult>

const MAX_REDIRECTS = 5
const USER_AGENT = 'Mozilla/5.0 (compatible; Gerechter/1.0; receptimport)'

function isBlocked(error: unknown): boolean {
  for (let current = error; current instanceof Error; current = current.cause)
    if ((current as { code?: string }).code === 'EGERECHTER_BLOCKED') return true
  return false
}

async function readLimited(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel()
    throw new Invalid(`Het bestand is groter dan ${Math.round(maxBytes / 1024 / 1024)} MB.`)
  }
  if (!response.body) return new Uint8Array()
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new Invalid(`Het bestand is groter dan ${Math.round(maxBytes / 1024 / 1024)} MB.`)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

export function createSafeFetch(fetcher: OutboundFetcher = publicOnlyFetcher): SafeFetch {
  return async (input, { maxBytes, accept, referer, timeoutMs = 10_000 }) => {
    const signal = AbortSignal.timeout(timeoutMs)
    let url = validateOutboundUrl(input)
    try {
      for (let hop = 0; ; hop++) {
        const response = await fetcher(url.href, {
          redirect: 'manual',
          signal,
          headers: {
            accept,
            'user-agent': USER_AGENT,
            'accept-language': 'nl,en;q=0.8',
            ...(referer ? { referer } : {}),
          },
        })
        const location = response.headers.get('location')
        if (response.status >= 300 && response.status < 400 && location) {
          await response.body?.cancel()
          if (hop >= MAX_REDIRECTS) throw new Invalid('De pagina verwijst te vaak door.')
          url = validateOutboundUrl(new URL(location, url))
          continue
        }
        if (!response.ok) {
          await response.body?.cancel()
          throw new Invalid(
            [401, 403, 429].includes(response.status)
              ? `De site weigert geautomatiseerde verzoeken (status ${response.status}).`
              : `De pagina gaf status ${response.status}.`,
          )
        }
        const contentType = response.headers.get('content-type') ?? ''
        return {
          finalUrl: url.href,
          contentType: contentType.split(';')[0]!.trim().toLowerCase(),
          charset: contentType.match(/charset="?([\w-]+)/i)?.[1]?.toLowerCase() ?? null,
          bytes: await readLimited(response, maxBytes),
        }
      }
    } catch (error) {
      if (error instanceof Invalid) throw error
      if (isBlocked(error)) throw new Invalid('Dit adres is niet toegestaan.')
      if (signal.aborted) throw new Invalid('Het ophalen duurde te lang.')
      throw new Invalid(`De pagina kon niet worden opgehaald (${url.hostname}).`)
    }
  }
}
