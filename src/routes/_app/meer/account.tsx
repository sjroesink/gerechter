import { createFileRoute } from '@tanstack/react-router'
import { LogOutIcon } from '~/components/icons'
import { Button, DetailHeader, Page } from '~/components/ui'
import { ThemeSelect } from '~/components/theme-select'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/_app/meer/account')({
  head: () => ({ meta: [{ title: 'Account · Gerechter' }] }),
  component: AccountPage,
})

function AccountPage() {
  const { shell } = Route.useRouteContext()
  return (
    <>
      <DetailHeader title="Account" back="/meer" backLabel="Terug naar Meer" />
      <Page>
        <dl className="flex flex-col overflow-hidden rounded-2xl bg-surface">
          <div className="border-b border-line-soft px-4 py-3">
            <dt className="text-[13px] text-ink-3">Naam</dt>
            <dd className="text-base font-semibold">{shell.user.name}</dd>
          </div>
          <div className="px-4 py-3">
            <dt className="text-[13px] text-ink-3">E-mailadres</dt>
            <dd className="text-base font-semibold break-all">{shell.user.email}</dd>
          </div>
        </dl>
        <ThemeSelect />
        <p className="px-1 text-[13px] text-ink-3">
          Wachtwoord vergeten? Vraag de beheerder om een herstellink.
        </p>
        <Button
          variant="secondary"
          className="self-start"
          onClick={async () => {
            await authClient.signOut()
            window.location.href = '/login'
          }}
        >
          <LogOutIcon size={20} />
          Uitloggen
        </Button>
      </Page>
    </>
  )
}
