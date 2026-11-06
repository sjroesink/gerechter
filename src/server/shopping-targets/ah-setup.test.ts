import { afterEach, expect, test, vi } from 'vitest'
const config = vi.hoisted(() => ({ AH_SIDECAR_URL: '', AH_SIDECAR_SECRET: '' }))
vi.mock('../runtime', () => ({ env: () => config }))
import { getAhSetup } from './ah-setup'
import { AH_AUTHORIZATION_URL } from './ah'

afterEach(() => vi.unstubAllGlobals())
test('zonder sidecarconfiguratie is AH uitgeschakeld en volgt geen netwerkverzoek', async () => {
  config.AH_SIDECAR_URL = ''
  config.AH_SIDECAR_SECRET = ''
  const fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', fetcher)
  expect(await getAhSetup()).toEqual({
    enabled: false,
    reachable: false,
    authorizationUrl: AH_AUTHORIZATION_URL,
  })
  expect(fetcher).not.toHaveBeenCalled()
})
test('een bereikbare service toont alleen veilige aanmeldinformatie', async () => {
  config.AH_SIDECAR_URL = 'http://sidecar:8000'
  config.AH_SIDECAR_SECRET = 'fictief-geheim-met-minstens-32-tekens'
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () =>
      Response.json({ experimental: true, authorization_url: AH_AUTHORIZATION_URL }),
    ),
  )
  const setup = await getAhSetup()
  expect(setup).toMatchObject({ enabled: true, reachable: true })
  expect(JSON.stringify(setup)).not.toContain(config.AH_SIDECAR_SECRET)
})
test('een onbereikbare service geeft een herstelbare status zonder ruwe fouten', async () => {
  config.AH_SIDECAR_URL = 'http://sidecar:8000'
  config.AH_SIDECAR_SECRET = 'fictief-geheim-met-minstens-32-tekens'
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async () => {
      throw new Error(config.AH_SIDECAR_SECRET)
    }),
  )
  expect(await getAhSetup()).toEqual({
    enabled: true,
    reachable: false,
    authorizationUrl: AH_AUTHORIZATION_URL,
  })
})
