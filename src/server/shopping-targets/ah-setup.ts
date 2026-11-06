import { env } from '../runtime'
import { AH_AUTHORIZATION_URL, ahSidecar } from './ah'

/** Used only inside server handlers; kept outside the browser-facing server-function module. */
export async function getAhSetup() {
  const config = env()
  if (!config.AH_SIDECAR_URL || !config.AH_SIDECAR_SECRET)
    return { enabled: false, reachable: false, authorizationUrl: AH_AUTHORIZATION_URL }
  try {
    return {
      enabled: true,
      reachable: true,
      ...(await ahSidecar({ url: config.AH_SIDECAR_URL, secret: config.AH_SIDECAR_SECRET }).info()),
    }
  } catch {
    return { enabled: true, reachable: false, authorizationUrl: AH_AUTHORIZATION_URL }
  }
}
