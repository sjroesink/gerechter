import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AuthCard, Button, Field, Notice, buttonClass } from '~/components/ui'
import { getSetupStatus, runSetup } from '~/server/accounts.functions'

export const Route = createFileRoute('/setup')({
  loader: () => getSetupStatus(),
  head: () => ({ meta: [{ title: 'Setup · Gerechter' }] }),
  component: SetupPage,
})

function SetupPage() {
  const { available } = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!available) {
    return (
      <AuthCard title="Setup niet beschikbaar" intro="Gerechter is al ingesteld.">
        <Link to="/login" search={{}} className={buttonClass('primary')}>
          Naar inloggen
        </Link>
      </AuthCard>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const res = await runSetup({
      data: {
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      },
    })
    if (res.ok) window.location.href = '/week'
    else {
      setBusy(false)
      setError(res.message)
    }
  }

  return (
    <AuthCard
      title="Welkom"
      intro="Maak het eerste account aan. Gebruik het beheerdersadres uit de configuratie; dit account wordt platformbeheerder."
    >
      {error && <Notice tone="error">{error}</Notice>}
      <form method="post" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Naam" name="name" autoComplete="name" required />
        <Field label="E-mailadres" name="email" type="email" autoComplete="email" required />
        <Field
          label="Wachtwoord"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="Minstens 8 tekens."
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Bezig…' : 'Account aanmaken'}
        </Button>
      </form>
    </AuthCard>
  )
}
