import { z } from 'zod'
import { Invalid } from '~/domain/core'
import type {
  ShoppingProviderRequest,
  ShoppingProviderResult,
  ShoppingTarget,
} from '~/domain/shopping-target'

export type AhSidecarConfig = { url: string; secret: string }
export type AhReference = { connectionId: string; connectionKey: string }
export const AH_AUTHORIZATION_URL =
  'https://login.ah.nl/login?client_id=appie-ios&redirect_uri=appie%3A%2F%2Flogin-exit&response_type=code'
const referenceInput = z.object({
  connection_id: z.string().uuid(),
  connection_key: z
    .string()
    .min(32)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/),
})
const jobInput = z
  .object({
    export_id: z.string().uuid(),
    status: z.enum(['pending', 'succeeded', 'failed', 'uncertain']),
    completed: z.number().int().min(0),
    total: z.number().int().min(1),
    message: z.string().max(1000).nullable().optional(),
    verified_absent: z.boolean().optional(),
  })
  .refine((value) => value.completed <= value.total)
const uncertain = (runId: string): ShoppingProviderResult => ({
  status: 'uncertain',
  externalId: runId,
  message: 'Het AH-resultaat is onzeker. Controleer de status; er wordt niets automatisch opnieuw verstuurd.',
})

export function ahSidecar(config: AhSidecarConfig, fetcher: typeof fetch = fetch) {
  async function request(
    path: string,
    options: { method?: string; body?: object; key?: string; timeout?: number } = {},
  ) {
    return fetcher(`${config.url.replace(/\/+$/, '')}${path}`, {
      method: options.method ?? 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(options.timeout ?? 20_000),
      headers: {
        authorization: `Bearer ${config.secret}`,
        ...(options.key ? { 'X-Connection-Key': options.key } : {}),
        ...(options.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })
  }
  async function jobResult(
    response: Response,
    runId: string,
    checking = false,
  ): Promise<ShoppingProviderResult> {
    if (response.ok) {
      const parsed = jobInput.safeParse(await response.json().catch(() => null))
      if (!parsed.success || parsed.data.export_id !== runId) return uncertain(runId)
      const job = parsed.data
      return {
        status: job.status,
        externalId: runId,
        message: `AH (experimenteel): ${job.completed} van ${job.total} regels bevestigd.${job.message && job.status !== 'succeeded' ? ` ${job.message}` : ''}`,
        verifiedAbsent: checking && job.verified_absent === true,
      }
    }
    const error = z
      .object({ detail: z.object({ code: z.string() }) })
      .safeParse(await response.json().catch(() => null))
    if (checking && response.status === 404 && error.success && error.data.detail.code === 'export_not_found')
      return {
        status: 'uncertain',
        externalId: runId,
        verifiedAbsent: true,
        message: 'Geen AH-exportjob gevonden. Controleer de AH-lijst voordat je bewust opnieuw exporteert.',
      }
    if (!checking && response.status >= 400 && response.status < 500 && response.status !== 408)
      return {
        status: 'failed',
        message: `De AH-service heeft het verzoek geweigerd (HTTP ${response.status}). Controleer de verbinding.`,
      }
    return uncertain(runId)
  }
  return {
    async info() {
      const response = await request('/auth-info', { timeout: 3000 })
      if (!response.ok) throw new Invalid('De AH-service is niet bereikbaar of de servertoegang is ongeldig.')
      const info = z
        .object({ authorization_url: z.string().url(), experimental: z.literal(true) })
        .safeParse(await response.json())
      if (
        !info.success ||
        new URL(info.data.authorization_url).hostname !== 'login.ah.nl' ||
        !info.data.authorization_url.startsWith('https://')
      )
        throw new Invalid('De AH-service geeft geen geldige aanmeldinformatie.')
      return { authorizationUrl: info.data.authorization_url, experimental: true }
    },
    async connect(householdId: string, code: string): Promise<AhReference> {
      try {
        const response = await request('/connections', {
          method: 'POST',
          body: { household_id: householdId, code },
        })
        if (!response.ok) throw new Error('Aanmelding geweigerd')
        const ref = referenceInput.safeParse(await response.json())
        if (!ref.success) throw new Error('Ongeldig verbindingsresultaat')
        return { connectionId: ref.data.connection_id, connectionKey: ref.data.connection_key }
      } catch {
        throw new Invalid(
          'AH-aanmelding niet gelukt. Controleer of de AH-service draait en gebruik zo nodig een nieuwe aanmeldcode.',
        )
      }
    },
    async disconnect(reference: AhReference) {
      try {
        return (
          await request(`/connections/${encodeURIComponent(reference.connectionId)}`, {
            method: 'DELETE',
            key: reference.connectionKey,
          })
        ).ok
      } catch {
        return false
      }
    },
    target: {
      async send(input: ShoppingProviderRequest) {
        if (
          !input.connection ||
          input.needs.lines.length > 500 ||
          input.needs.lines.some((line) => !line.length || line.length > 2000)
        )
          return {
            status: 'failed',
            message: 'Deze AH-verbinding of lijst is niet geldig. Exporteer zo nodig een kleinere selectie.',
          }
        try {
          return await jobResult(
            await request(`/connections/${encodeURIComponent(input.connection.destinationId)}/exports`, {
              method: 'POST',
              key: input.connection.secret,
              body: { export_id: input.runId, lines: input.needs.lines },
            }),
            input.runId,
          )
        } catch {
          return uncertain(input.runId)
        }
      },
      async check(input: ShoppingProviderRequest) {
        if (!input.connection) return uncertain(input.runId)
        try {
          return await jobResult(
            await request(
              `/connections/${encodeURIComponent(input.connection.destinationId)}/exports/${encodeURIComponent(input.runId)}?check=true`,
              { key: input.connection.secret },
            ),
            input.runId,
            true,
          )
        } catch {
          return uncertain(input.runId)
        }
      },
    } satisfies ShoppingTarget,
  }
}
