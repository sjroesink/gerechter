import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { CookingForm } from '~/components/cooking-form'
import { DetailHeader, Notice, Page, Stepper } from '~/components/ui'
import { getCookingPreparation } from '~/server/cooking.functions'

export const Route = createFileRoute('/_app/gerechten/$recipeId/gemaakt')({
  validateSearch: (search: Record<string, unknown>): { plannedMealId?: string; servings?: number } => ({
    plannedMealId: typeof search.plannedMealId === 'string' ? search.plannedMealId.slice(0, 100) : undefined,
    servings:
      typeof search.servings === 'number' &&
      Number.isInteger(search.servings) &&
      search.servings >= 1 &&
      search.servings <= 1000
        ? search.servings
        : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ params, deps }) => getCookingPreparation({ data: { ...params, ...deps } }),
  staleTime: 0,
  head: () => ({ meta: [{ title: 'Gemaakt registreren · Gerechter' }] }),
  component: MadePage,
})
function MadePage() {
  const result = Route.useLoaderData()
  const { recipeId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const router = useRouter()
  const [pending, setPending] = useState<{ base: number; value: number } | null>(null)
  return (
    <>
      <DetailHeader
        title="Gemaakt registreren"
        subtitle={result.ok ? result.data.name : undefined}
        back="/gerechten/$recipeId"
        backParams={{ recipeId }}
        backLabel="Terug naar gerecht"
      />
      <Page className="min-h-[calc(100dvh-11rem)] lg:min-h-0">
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-2xl bg-surface py-2 pr-2 pl-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold">Gemaakt voor</h2>
                <p className="text-[13px] text-ink-3">Een ander aantal maakt een nieuw afboekvoorstel.</p>
              </div>
              <div role="group" aria-label="Personen" className="flex items-center gap-1.5">
                <span className="text-sm text-ink-3">Personen</span>
                <Stepper
                  label="personen"
                  min={1}
                  max={1000}
                  value={
                    pending && pending.base === result.data.servings ? pending.value : result.data.servings
                  }
                  onChange={(value) => {
                    setPending({ base: result.data.servings, value })
                    void navigate({
                      search: { ...search, servings: value },
                      replace: true,
                      resetScroll: false,
                    })
                  }}
                />
              </div>
            </div>
            <CookingForm
              key={result.data.requestId}
              preparation={result.data}
              saved={async (eventId) => {
                await navigate({ to: '/meer/geschiedenis/$eventId', params: { eventId } })
              }}
              refresh={async () => {
                await router.invalidate()
              }}
            />
          </>
        )}
      </Page>
    </>
  )
}
