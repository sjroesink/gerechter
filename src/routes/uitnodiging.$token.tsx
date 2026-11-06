import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { AuthCard, Button, Field, Notice, buttonClass } from '~/components/ui'
import { acceptInviteFn, getInvite, registerViaInvite } from '~/server/accounts.functions'
import { isLoggedIn } from '~/server/session.functions'

export const Route = createFileRoute('/uitnodiging/$token')({
  loader: async ({ params }) => ({
    invite: await getInvite({ data: { token: params.token } }),
    loggedIn: await isLoggedIn(),
  }),
  head: () => ({ meta: [{ title: 'Uitnodiging · Gerechter' }] }),
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const { invite, loggedIn } = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!invite.ok) {
    return (
      <AuthCard title="Uitnodiging ongeldig" intro={invite.message}>
        <Link to="/login" search={{}} className={buttonClass('secondary')}>
          Naar inloggen
        </Link>
      </AuthCard>
    )
  }

  const intro =
    invite.kind === 'new_household'
      ? `Je bent uitgenodigd om het huishouden ${invite.householdName} te starten op Gerechter.`
      : `Je bent uitgenodigd voor het huishouden ${invite.householdName} op Gerechter.`

  if (loggedIn) {
    return (
      <AuthCard title="Uitnodiging" intro={intro}>
        {error && <Notice tone="error">{error}</Notice>}
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const res = await acceptInviteFn({ data: { token } })
            if (res.ok) window.location.href = '/week'
            else {
              setBusy(false)
              setError(res.message)
            }
          }}
        >
          Uitnodiging accepteren
        </Button>
      </AuthCard>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    const res = await registerViaInvite({
      data: {
        token,
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
    <AuthCard title="Account aanmaken" intro={intro}>
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
      <p className="text-[13px] text-ink-3">
        Heb je al een account?{' '}
        <Link
          to="/login"
          search={{ redirect: `/uitnodiging/${token}` }}
          className="inline-flex min-h-11 min-w-11 items-center justify-center px-2 font-semibold text-tomato"
        >
          Log in
        </Link>{' '}
        en open deze link opnieuw.
      </p>
    </AuthCard>
  )
}
