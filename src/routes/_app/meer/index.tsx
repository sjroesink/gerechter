import { createFileRoute } from '@tanstack/react-router'
import { HouseholdSwitcher } from '~/components/app-shell'
import { BoxIcon, LogOutIcon, PlugIcon, PotIcon, ShieldIcon, UserIcon, UsersIcon } from '~/components/icons'
import { Button, ListGroup, ListLink, Page, SectionHeader } from '~/components/ui'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/_app/meer/')({
  head: () => ({ meta: [{ title: 'Meer · Gerechter' }] }),
  component: MeerPage,
})

function MeerPage() {
  const { shell } = Route.useRouteContext()
  return (
    <>
      <SectionHeader title="Meer" />
      <Page>
        <ListGroup label="Instellingen">
          <ListLink
            to="/meer/boodschappen"
            icon={<BoxIcon />}
            title="Boodschappen"
            detail="Behoefte, delen en exporthistorie"
          />
          <ListLink
            to="/meer/geschiedenis"
            icon={<PotIcon />}
            title="Gemaakt"
            detail="Bereidingen en beoordelingen"
          />
          <ListLink
            to="/meer/ingredienten"
            icon={<BoxIcon />}
            title="Ingrediënten"
            detail="Catalogus en eenheden"
          />
          <ListLink to="/meer/account" icon={<UserIcon />} title="Account" detail={shell.user.email} />
          <ListLink
            to="/meer/huishouden"
            icon={<UsersIcon />}
            title="Huishouden"
            detail={shell.household?.name}
          />
          <ListLink
            to="/meer/verbonden-apps"
            icon={<PlugIcon />}
            title="Verbonden apps"
            detail="AI-agents via MCP"
          />
          {shell.user.isAdmin && (
            <ListLink
              to="/meer/beheer"
              icon={<ShieldIcon />}
              title="Beheer"
              detail="Huishoudens en accounts"
            />
          )}
        </ListGroup>
        <div className="lg:hidden">
          <HouseholdSwitcher shell={shell} />
        </div>
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
