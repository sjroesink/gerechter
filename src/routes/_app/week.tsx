import { createFileRoute } from '@tanstack/react-router'
import { CalendarIcon } from '~/components/icons'
import { EmptyState, Page, SectionHeader } from '~/components/ui'

export const Route = createFileRoute('/_app/week')({
  head: () => ({ meta: [{ title: 'Week · Gerechter' }] }),
  component: () => (
    <>
      <SectionHeader title="Week" />
      <Page>
        <EmptyState icon={<CalendarIcon />} title="Nog geen weekplanning">
          Hier plan je straks per dag een gerecht of iets als Restjes of Bestellen. Deze functie komt
          binnenkort.
        </EmptyState>
      </Page>
    </>
  ),
})
