import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AuthCard, Button, Field, Notice, buttonClass } from '~/components/ui'
import { resetPasswordFn } from '~/server/accounts.functions'

export const Route = createFileRoute('/herstel/$token')({
  head: () => ({ meta: [{ title: 'Nieuw wachtwoord · Gerechter' }] }),
  component: ResetPage,
})

function ResetPage() {
  const { token } = Route.useParams()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  if (done) {
    return (
      <AuthCard title="Wachtwoord ingesteld" intro="Je kunt nu inloggen met je nieuwe wachtwoord.">
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
    const res = await resetPasswordFn({ data: { token, password: String(form.get('password') ?? '') } })
    setBusy(false)
    if (res.ok) setDone(true)
    else setError(res.message)
  }

  return (
    <AuthCard title="Nieuw wachtwoord" intro="Kies een nieuw wachtwoord. Daarna word je overal uitgelogd.">
      {error && <Notice tone="error">{error}</Notice>}
      <form method="post" onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Nieuw wachtwoord"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="Minstens 8 tekens."
        />
        <Button type="submit" disabled={busy}>
          {busy ? 'Bezig…' : 'Wachtwoord instellen'}
        </Button>
      </form>
    </AuthCard>
  )
}
