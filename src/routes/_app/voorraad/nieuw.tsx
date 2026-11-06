import { createFileRoute } from '@tanstack/react-router'
import { PantryForm } from '~/components/pantry-form'
import { DetailHeader, Page } from '~/components/ui'

export const Route = createFileRoute('/_app/voorraad/nieuw')({
  head: () => ({ meta: [{ title: 'Ingrediënt toevoegen · Gerechter' }] }),
  component: NewPantry,
})
function NewPantry() {
  const navigate = Route.useNavigate()
  return (
    <>
      <DetailHeader
        title="Ingrediënt toevoegen"
        subtitle="Aan je voorraad"
        back="/voorraad"
        backLabel="Terug naar voorraad"
      />
      <Page className="lg:max-w-2xl">
        <PantryForm
          saved={async (item) => {
            await navigate({ to: '/voorraad/$ingredientId', params: { ingredientId: item.ingredientId } })
          }}
        />
      </Page>
    </>
  )
}
