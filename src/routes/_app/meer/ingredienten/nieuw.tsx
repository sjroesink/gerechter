import { createFileRoute } from '@tanstack/react-router'
import { IngredientForm } from '~/components/ingredient-form'
import { DetailHeader, Page } from '~/components/ui'
import { createIngredientFn } from '~/server/catalog.functions'

export const Route = createFileRoute('/_app/meer/ingredienten/nieuw')({
  head: () => ({ meta: [{ title: 'Ingrediënt toevoegen · Gerechter' }] }),
  component: NewIngredientPage,
})

function NewIngredientPage() {
  const { shell } = Route.useRouteContext()
  const navigate = Route.useNavigate()
  return (
    <>
      <DetailHeader
        title="Ingrediënt toevoegen"
        back="/meer/ingredienten"
        backLabel="Terug naar ingrediënten"
      />
      <Page className="lg:max-w-2xl">
        <IngredientForm
          canCreateGlobal={shell.user.isAdmin}
          save={async (input) => {
            const result = await createIngredientFn({
              data: { ...input, aliases: input.aliases ?? [], scope: input.scope ?? 'household' },
            })
            if (result.ok)
              await navigate({
                to: '/meer/ingredienten/$ingredientId',
                params: { ingredientId: result.data.id },
              })
            return result
          }}
        />
      </Page>
    </>
  )
}
