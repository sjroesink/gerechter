import { createFileRoute } from '@tanstack/react-router'
import { RecipeForm } from '~/components/recipe-form'
import { DetailHeader, Notice, Page } from '~/components/ui'
import { getRecipePage, updateRecipeFn } from '~/server/recipes.functions'

export const Route = createFileRoute('/_app/gerechten/$recipeId/bewerken')({
  loader: ({ params }) => getRecipePage({ data: params }),
  head: () => ({ meta: [{ title: 'Gerecht bewerken · Gerechter' }] }),
  component: EditRecipePage,
})
function EditRecipePage() {
  const result = Route.useLoaderData()
  const { recipeId } = Route.useParams()
  const navigate = Route.useNavigate()
  return (
    <>
      <DetailHeader
        title="Gerecht bewerken"
        back="/gerechten/$recipeId"
        backParams={{ recipeId }}
        backLabel="Terug naar gerecht"
      />
      <Page>
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : (
          <RecipeForm
            key={`${recipeId}-${result.data.version}`}
            initial={result.data}
            save={async (input) => {
              const saved = await updateRecipeFn({
                data: { ...input, recipeId, version: result.data.version },
              })
              if (saved.ok) await navigate({ to: '/gerechten/$recipeId', params: { recipeId } })
              return saved
            }}
          />
        )}
      </Page>
    </>
  )
}
