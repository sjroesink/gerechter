import { createFileRoute } from '@tanstack/react-router'
import { PotIcon } from '~/components/icons'
import { EmptyState, Page, SectionHeader } from '~/components/ui'

export const Route = createFileRoute('/_app/gerechten')({
  head: () => ({ meta: [{ title: 'Gerechten · Gerechter' }] }),
  component: () => (
    <>
      <SectionHeader title="Gerechten" />
      <Page>
        <EmptyState icon={<PotIcon />} title="Nog geen gerechten">
          Hier verzamel je straks je recepten, met foto, instructies en hoe vaak je ze gemaakt hebt. Deze
          functie komt binnenkort.
        </EmptyState>
      </Page>
    </>
  ),
})
