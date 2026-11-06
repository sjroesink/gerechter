import { createFileRoute } from '@tanstack/react-router'
import { PlannedMealForm } from '~/components/planned-meal-form'
import { dayTitle } from '~/components/planning-dates'
import { DetailHeader, Notice, Page } from '~/components/ui'
import { isCalendarDate } from '~/domain/calendar'
import { createPlannedMealFn, getNewPlanPage } from '~/server/planning.functions'

export const Route = createFileRoute('/_app/week/nieuw')({
  validateSearch: (search: Record<string, unknown>): { date?: string; recipeId?: string } => ({
    date: typeof search.date === 'string' && isCalendarDate(search.date) ? search.date : undefined,
    recipeId: typeof search.recipeId === 'string' ? search.recipeId.slice(0, 100) : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getNewPlanPage({ data: deps }),
  head: () => ({ meta: [{ title: 'Maaltijd plannen · Gerechter' }] }),
  component: NewMealPage,
})
function NewMealPage() {
  const result = Route.useLoaderData()
  const navigate = Route.useNavigate()
  return (
    <>
      <DetailHeader
        title="Wat eten we?"
        subtitle={result.ok ? dayTitle(result.data.date) : undefined}
        back="/week"
        backSearch={result.ok ? { week: result.data.date } : {}}
        backLabel="Terug naar week"
      />
      <Page>
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : (
          <PlannedMealForm
            date={result.data.date}
            selectedRecipe={result.data.recipe}
            defaultServings={result.data.preferences.defaultServings}
            save={async (input) => {
              const saved = await createPlannedMealFn({ data: input })
              if (saved.ok)
                await navigate({ to: '/week/maaltijd/$mealId', params: { mealId: saved.data.id } })
              return saved
            }}
          />
        )}
      </Page>
    </>
  )
}
