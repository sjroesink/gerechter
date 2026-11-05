import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState, useSyncExternalStore } from 'react'
import { PlugIcon } from '~/components/icons'
import { Button, DetailHeader, EmptyState, Notice, Page } from '~/components/ui'
import { getConnectedApps, revokeConnectedAppFn } from '~/server/connected-apps.functions'

export const Route = createFileRoute('/_app/meer/verbonden-apps')({
  head: () => ({ meta: [{ title: 'Verbonden apps · Gerechter' }] }),
  loader: () => getConnectedApps(),
  component: ConnectedAppsPage,
})

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })

const noSubscribe = () => () => {}

function ConnectedAppsPage() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  // Server rendert een lege origin, de browser vult hem in (zonder hydratieverschil).
  const origin = useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => '',
  )

  return (
    <>
      <DetailHeader title="Verbonden apps" back="/meer" backLabel="Terug naar Meer" />
      <Page>
        <p className="px-1 text-[15px] text-ink-2">
          AI-agents die via MCP namens jou in Gerechter werken. Verbind een agent met{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 text-[13px]">{origin}/mcp</code>.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : result.data.length === 0 ? (
          <EmptyState icon={<PlugIcon />} title="Nog geen verbonden apps">
            Zodra je een agent toegang geeft, zie je hem hier en kun je de toegang weer intrekken.
          </EmptyState>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
            {result.data.map((app) => (
              <li
                key={app.id}
                className="flex items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold">{app.name}</div>
                  <div className="text-[13px] text-ink-3">
                    Sinds {dateFormat.format(new Date(app.createdAt))}
                  </div>
                </div>
                <Button
                  variant="danger"
                  className="min-h-11 px-4 text-sm"
                  onClick={async () => {
                    if (!confirm(`Toegang van ${app.name} intrekken?`)) return
                    setError(null)
                    const res = await revokeConnectedAppFn({ data: { consentId: app.id } })
                    if (!res.ok) setError(res.message)
                    await router.invalidate()
                  }}
                >
                  Intrekken
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  )
}
