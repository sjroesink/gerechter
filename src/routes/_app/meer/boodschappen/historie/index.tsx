import { createFileRoute, Link } from '@tanstack/react-router'
import { shoppingStatusLabels, shoppingTargetLabels } from '~/components/shopping-labels'
import { ChevronRightIcon } from '~/components/icons'
import { DetailHeader, Notice, Page } from '~/components/ui'
import { getShoppingRunsPage } from '~/server/shopping.functions'

export const Route = createFileRoute('/_app/meer/boodschappen/historie/')({
  loader: () => getShoppingRunsPage(),
  head: () => ({ meta: [{ title: 'Exporthistorie · Gerechter' }] }),
  component: RunsPage,
})
const date = new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })
function RunsPage() {
  const result = Route.useLoaderData()
  return (
    <>
      <DetailHeader title="Exporthistorie" back="/meer/boodschappen" backLabel="Terug naar boodschappen" />
      <Page>
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : result.data.length === 0 ? (
          <p className="px-1 text-[15px] text-ink-2">Nog geen boodschappenexports.</p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
            {result.data.map((run) => (
              <li key={run.id} className="border-b border-line-soft last:border-b-0">
                <Link
                  to="/meer/boodschappen/historie/$runId"
                  params={{ runId: run.id }}
                  className="flex min-h-15 items-center gap-3 px-4 py-3 hover:bg-ground"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-base font-semibold break-words">{run.title}</span>
                    <span className="text-[13px] text-ink-2">
                      {shoppingTargetLabels[run.target]} · {shoppingStatusLabels[run.status]}
                    </span>
                    <span className="text-[13px] text-ink-3">
                      {date.format(new Date(run.createdAt))} · {run.actorName}
                    </span>
                  </span>
                  <ChevronRightIcon size={20} className="shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Page>
    </>
  )
}
