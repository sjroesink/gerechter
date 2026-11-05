import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { PlusIcon } from '~/components/icons'
import { ShareLink } from '~/components/share-link'
import { Button, DetailHeader, Notice, Page, SectionTitle } from '~/components/ui'
import {
  changeRoleFn,
  createInviteFn,
  getHouseholdPage,
  leaveHouseholdFn,
  removeMemberFn,
  revokeInviteFn,
} from '~/server/households.functions'
import type { ActionResult } from '~/server/fn'

export const Route = createFileRoute('/_app/meer/huishouden')({
  head: () => ({ meta: [{ title: 'Huishouden · Gerechter' }] }),
  loader: () => getHouseholdPage(),
  component: HouseholdPage,
})

const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long' })

function HouseholdPage() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<string | null>(null)

  async function run(action: () => Promise<ActionResult<unknown>>) {
    setError(null)
    const res = await action()
    if (!res.ok) setError(res.message)
    await router.invalidate()
    return res
  }

  if (!result.ok) {
    return (
      <>
        <DetailHeader title="Huishouden" back="/meer" backLabel="Terug naar Meer" />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  }

  const { household, members, invites } = result.data
  const isOwner = household.role === 'owner'

  return (
    <>
      <DetailHeader title={household.name} subtitle="Huishouden" back="/meer" backLabel="Terug naar Meer" />
      <Page>
        {error && <Notice tone="error">{error}</Notice>}

        <section className="flex flex-col gap-2">
          <SectionTitle>Leden</SectionTitle>
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
            {members.map((m) => (
              <li
                key={m.userId}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold">
                    {m.name}
                    {m.isMe && <span className="font-normal text-ink-3"> (jij)</span>}
                  </div>
                  <div className="truncate text-[13px] text-ink-3">{m.email}</div>
                </div>
                <span
                  className={
                    m.role === 'owner'
                      ? 'rounded-full bg-herb-soft px-2.5 py-1 text-xs font-bold text-herb-dark'
                      : 'rounded-full bg-muted px-2.5 py-1 text-xs font-bold text-ink-2'
                  }
                >
                  {m.role === 'owner' ? 'eigenaar' : 'lid'}
                </span>
                {isOwner && !m.isMe && (
                  <div className="flex w-full gap-2">
                    <Button
                      variant="secondary"
                      className="min-h-11 px-4 text-sm"
                      onClick={() =>
                        run(() =>
                          changeRoleFn({
                            data: { userId: m.userId, role: m.role === 'owner' ? 'member' : 'owner' },
                          }),
                        )
                      }
                    >
                      {m.role === 'owner' ? 'Maak lid' : 'Maak eigenaar'}
                    </Button>
                    <Button
                      variant="danger"
                      className="min-h-11 px-4 text-sm"
                      onClick={() => {
                        if (confirm(`${m.name} uit het huishouden verwijderen?`)) {
                          void run(() => removeMemberFn({ data: { userId: m.userId } }))
                        }
                      }}
                    >
                      Verwijderen
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        {isOwner && (
          <section className="flex flex-col gap-2">
            <SectionTitle>Uitnodigen</SectionTitle>
            {newLink ? (
              <>
                <ShareLink
                  url={newLink}
                  title="Uitnodiging voor Gerechter"
                  text={`Doe mee met ${household.name} op Gerechter`}
                />
                <p className="px-1 text-[13px] text-ink-3">
                  De link is 7 dagen geldig en werkt één keer. Hij wordt na deze pagina niet meer getoond.
                </p>
              </>
            ) : (
              <Button
                className="self-start"
                onClick={async () => {
                  const res = await run(() => createInviteFn())
                  if (res.ok) setNewLink((res.data as { url: string }).url)
                }}
              >
                <PlusIcon size={20} />
                Uitnodigingslink maken
              </Button>
            )}
            {invites.length > 0 && (
              <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
                {invites.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0"
                  >
                    <div className="flex-1 text-[15px]">
                      Openstaande uitnodiging
                      <div className="text-[13px] text-ink-3">
                        Geldig tot {dateFormat.format(new Date(i.expiresAt))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="min-h-11 px-3 text-sm"
                      onClick={() => run(() => revokeInviteFn({ data: { inviteId: i.id } }))}
                    >
                      Intrekken
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <Button
          variant="danger"
          className="self-start"
          onClick={async () => {
            if (!confirm(`Weet je zeker dat je ${household.name} wilt verlaten?`)) return
            const res = await run(() => leaveHouseholdFn())
            if (res.ok) window.location.href = '/week'
          }}
        >
          Huishouden verlaten
        </Button>
      </Page>
    </>
  )
}
