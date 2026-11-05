import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '~/components/app-shell'
import { LogOutIcon } from '~/components/icons'
import { AuthCard, Button } from '~/components/ui'
import { authClient } from '~/lib/auth-client'
import { getShell } from '~/server/session.functions'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const shell = await getShell()
    if (!shell) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { shell }
  },
  component: AppLayout,
})

function AppLayout() {
  const { shell } = Route.useRouteContext()
  if (!shell.household) {
    return (
      <AuthCard
        title="Geen huishouden"
        intro="Je bent (niet meer) lid van een huishouden. Vraag iemand om een nieuwe uitnodigingslink."
      >
        <Button
          variant="secondary"
          onClick={async () => {
            await authClient.signOut()
            window.location.href = '/login'
          }}
        >
          <LogOutIcon size={20} />
          Uitloggen
        </Button>
      </AuthCard>
    )
  }
  return (
    <AppShell shell={shell}>
      <Outlet />
    </AppShell>
  )
}
