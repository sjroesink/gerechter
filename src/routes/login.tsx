import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AuthCard, Button, Field, Notice } from '~/components/ui'
import { authClient } from '~/lib/auth-client'
import { safeRedirect } from '~/lib/redirect'
import { getSetupStatus } from '~/server/accounts.functions'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === 'string' ? { redirect: search.redirect } : {},
  beforeLoad: async () => {
    if ((await getSetupStatus()).available) throw redirect({ to: '/setup' })
  },
  head: () => ({ meta: [{ title: 'Inloggen · Gerechter' }] }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const { data, error } = await authClient.signIn.email({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    })
    if (error) {
      setBusy(false)
      setError(
        error.status === 429
          ? 'Te veel inlogpogingen. Wacht even en probeer het dan opnieuw.'
          : 'Inloggen is niet gelukt. Controleer je e-mailadres en wachtwoord.',
      )
      return
    }
    // Tijdens een OAuth-flow (MCP-agent) stuurt de server door naar de toestemmingspagina.
    const next = (data as { url?: string } | null)?.url
    window.location.href = next ?? safeRedirect(search.redirect)
  }

  return (
    <AuthCard title="Inloggen">
      {error && <Notice tone="error">{error}</Notice>}
      <form method="post" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="E-mailadres" name="email" type="email" autoComplete="email" required />
        <Field label="Wachtwoord" name="password" type="password" autoComplete="current-password" required />
        <Button type="submit" disabled={busy}>
          {busy ? 'Bezig…' : 'Inloggen'}
        </Button>
      </form>
      <p className="text-[13px] text-ink-3">
        Nog geen account? Je hebt een uitnodigingslink nodig van iemand uit je huishouden.
      </p>
    </AuthCard>
  )
}
