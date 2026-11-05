import { createFileRoute } from '@tanstack/react-router'
import { BoxIcon } from '~/components/icons'
import { EmptyState, Page, SectionHeader } from '~/components/ui'

export const Route = createFileRoute('/_app/voorraad')({
  head: () => ({ meta: [{ title: 'Voorraad · Gerechter' }] }),
  component: () => (
    <>
      <SectionHeader title="Voorraad" />
      <Page>
        <EmptyState icon={<BoxIcon />} title="Nog geen voorraad">
          Hier houd je straks bij wat je in huis hebt en wat altijd op voorraad is. Deze functie komt
          binnenkort.
        </EmptyState>
      </Page>
    </>
  ),
})
