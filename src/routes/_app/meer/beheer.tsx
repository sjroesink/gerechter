import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { ShareLink } from '~/components/share-link'
import { Button, DetailHeader, Field, ListGroup, ListLink, Notice, Page, SectionTitle } from '~/components/ui'
import { adminCreateHouseholdInvite, adminCreateResetLink, adminOverview } from '~/server/accounts.functions'

export const Route = createFileRoute('/_app/meer/beheer')({
  head: () => ({ meta: [{ title: 'Beheer · Gerechter' }] }),
  beforeLoad: ({ context }) => {
    if (!context.shell.user.isAdmin) throw redirect({ to: '/meer' })
  },
  loader: () => adminOverview(),
  component: AdminPage,
})

function AdminPage() {
  const overview = Route.useLoaderData()
  const [error, setError] = useState<string | null>(null)
  const [householdLink, setHouseholdLink] = useState<string | null>(null)
  const [resetLink, setResetLink] = useState<{ name: string; url: string } | null>(null)

  async function inviteHousehold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const res = await adminCreateHouseholdInvite({ data: { householdName: String(form.get('name') ?? '') } })
    if (res.ok) setHouseholdLink(res.data.url)
    else setError(res.message)
  }

  return (
    <>
      <DetailHeader title="Beheer" back="/meer" backLabel="Terug naar Meer" />
      <Page>
        {error && <Notice tone="error">{error}</Notice>}
        <ListGroup label="Catalogusbeheer">
          <ListLink
            to="/meer/ingredienten"
            title="Ingrediëntencatalogus"
            detail="Globale ingrediënten en omrekeningen beheren"
          />
        </ListGroup>

        <section className="flex flex-col gap-2">
          <SectionTitle>Nieuw huishouden uitnodigen</SectionTitle>
          {householdLink ? (
            <>
              <ShareLink
                url={householdLink}
                title="Uitnodiging voor Gerechter"
                text="Start je huishouden op Gerechter"
              />
              <Button variant="ghost" className="self-start" onClick={() => setHouseholdLink(null)}>
                Nog een uitnodiging maken
              </Button>
            </>
          ) : (
            <form
              method="post"
              onSubmit={inviteHousehold}
              className="flex flex-col gap-3 rounded-[20px] bg-surface p-5"
            >
              <Field
                label="Naam van het huishouden"
                name="name"
                required
                maxLength={100}
                placeholder="Familie Jansen"
              />
              <Button type="submit" className="self-start">
                Uitnodigingslink maken
              </Button>
            </form>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <SectionTitle>Accounts</SectionTitle>
          {resetLink && (
            <>
              <Notice tone="success">
                Herstellink voor {resetLink.name}. Hij is 24 uur geldig en werkt één keer.
              </Notice>
              <ShareLink
                url={resetLink.url}
                title="Wachtwoord herstellen"
                text="Stel een nieuw wachtwoord in voor Gerechter"
              />
            </>
          )}
          {overview.ok ? (
            <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
              {overview.data.users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-semibold">
                      {u.name}
                      {u.role === 'admin' && <span className="font-normal text-ink-3"> (beheerder)</span>}
                    </div>
                    <div className="truncate text-[13px] text-ink-3">{u.email}</div>
                  </div>
                  <Button
                    variant="ghost"
                    className="min-h-11 px-3 text-sm"
                    onClick={async () => {
                      setError(null)
                      const res = await adminCreateResetLink({ data: { userId: u.id } })
                      if (res.ok) setResetLink({ name: u.name, url: res.data.url })
                      else setError(res.message)
                    }}
                  >
                    Herstellink
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Notice tone="error">{overview.message}</Notice>
          )}
        </section>
      </Page>
    </>
  )
}
