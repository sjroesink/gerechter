import { createFileRoute } from '@tanstack/react-router'
import { RecipeForm } from '~/components/recipe-form'
import { DetailHeader, Page } from '~/components/ui'
import { createRecipeFn } from '~/server/recipes.functions'

export const Route = createFileRoute('/_app/gerechten/nieuw')({
  head: () => ({ meta: [{ title: 'Gerecht toevoegen · Gerechter' }] }),
  component: NewRecipePage,
})
function NewRecipePage() {
  const navigate = Route.useNavigate()
  return (
    <>
      <DetailHeader title="Gerecht toevoegen" back="/gerechten" backLabel="Terug naar gerechten" />
      <Page>
        <RecipeForm
          save={async (input) => {
            const result = await createRecipeFn({ data: input })
            if (result.ok)
              await navigate({ to: '/gerechten/$recipeId', params: { recipeId: result.data.id } })
            return result
          }}
        />
      </Page>
    </>
  )
}
