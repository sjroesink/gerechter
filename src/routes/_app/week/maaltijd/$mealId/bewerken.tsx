import { createFileRoute } from '@tanstack/react-router'
import { PlannedMealForm } from '~/components/planned-meal-form'
import { dayTitle } from '~/components/planning-dates'
import { DetailHeader, Notice, Page } from '~/components/ui'
import { getPlannedMealPage, updatePlannedMealFn } from '~/server/planning.functions'

export const Route = createFileRoute('/_app/week/maaltijd/$mealId/bewerken')({
  loader: ({ params }) => getPlannedMealPage({ data: params }),
  head: () => ({ meta: [{ title: 'Maaltijd wijzigen · Gerechter' }] }),
  component: EditMealPage,
})
function EditMealPage() {
  const result = Route.useLoaderData()
  const { mealId } = Route.useParams()
  const navigate = Route.useNavigate()
  return (
    <>
      <DetailHeader
        title="Maaltijd wijzigen"
        subtitle={result.ok ? dayTitle(result.data.item.date) : undefined}
        back="/week/maaltijd/$mealId"
        backParams={{ mealId }}
        backLabel="Terug naar maaltijd"
      />
      <Page>
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : (
          <PlannedMealForm
            key={`${mealId}-${result.data.item.version}`}
            initial={result.data.item}
            date={result.data.item.date}
            defaultServings={result.data.preferences.defaultServings}
            save={async (input) => {
              const saved = await updatePlannedMealFn({
                data: { mealId, input: { ...input, version: result.data.item.version } },
              })
              if (saved.ok) await navigate({ to: '/week/maaltijd/$mealId', params: { mealId } })
              return saved
            }}
          />
        )}
      </Page>
    </>
  )
}
