import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { AuthCard, Button, Notice } from '~/components/ui'
import { authClient } from '~/lib/auth-client'
import { isLoggedIn } from '~/server/session.functions'

const scopeLabels: Record<string, string> = {
  openid: 'Weten wie je bent',
  profile: 'Je naam zien',
  email: 'Je e-mailadres zien',
  offline_access: 'Verbonden blijven zonder dat je steeds opnieuw inlogt',
}

export const Route = createFileRoute('/consent')({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string>,
  beforeLoad: async ({ location }) => {
    if (!(await isLoggedIn())) throw redirect({ to: '/login', search: { redirect: location.href } })
  },
  head: () => ({ meta: [{ title: 'Toegang geven · Gerechter' }] }),
  component: ConsentPage,
})

function ConsentPage() {
  const search = Route.useSearch()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scopes = (search.scope ?? '').split(' ').filter(Boolean)

  async function decide(accept: boolean) {
    setBusy(true)
    setError(null)
    const { data, error } = await authClient.oauth2.consent({ accept })
    const next =
      (data as { url?: string; redirect_uri?: string } | null)?.url ??
      (data as { redirect_uri?: string } | null)?.redirect_uri
    if (error || !next) {
      setBusy(false)
      setError('Dat is niet gelukt. Probeer het opnieuw vanuit de app.')
      return
    }
    window.location.href = next
  }

  return (
    <AuthCard
      title="Toegang geven"
      intro="Een app (bijvoorbeeld een AI-agent) wil via MCP namens jou werken in je huishouden op Gerechter."
    >
      {error && <Notice tone="error">{error}</Notice>}
      {scopes.length > 0 && (
        <ul className="flex flex-col gap-2 rounded-2xl bg-surface p-4 text-[15px]">
          {scopes.map((scope) => (
            <li key={scope}>{scopeLabels[scope] ?? scope}</li>
          ))}
          <li>Gerechten, planning en voorraad van je actieve huishouden lezen en wijzigen</li>
        </ul>
      )}
      <div className="flex flex-col gap-3">
        <Button disabled={busy} onClick={() => decide(true)}>
          Toestaan
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => decide(false)}>
          Weigeren
        </Button>
      </div>
      <p className="text-[13px] text-ink-3">
        Je kunt de toegang later intrekken onder Meer › Verbonden apps.
      </p>
    </AuthCard>
  )
}
