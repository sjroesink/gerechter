import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { AhConnectionForm } from '~/components/ah-connection-form'
import { Button, DetailHeader, Field, Notice, Page, SectionTitle } from '~/components/ui'
import {
  getShoppingTargetsPage,
  removeShoppingConnectionFn,
  saveNotionConnectionFn,
} from '~/server/shopping.functions'

export const Route = createFileRoute('/_app/meer/boodschappen/verbindingen')({
  loader: () => getShoppingTargetsPage(),
  head: () => ({ meta: [{ title: 'Boodschappenverbindingen · Gerechter' }] }),
  component: ConnectionsPage,
})
function ConnectionsPage() {
  const result = Route.useLoaderData()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const notion = result.ok ? result.data.targets.find((target) => target.target === 'notion') : undefined
  return (
    <>
      <DetailHeader
        title="Boodschappenverbindingen"
        back="/meer/boodschappen"
        backLabel="Terug naar boodschappen"
      />
      <Page>
        {!result.ok ? (
          <Notice tone="error">{result.message}</Notice>
        ) : (
          <>
            {error && <Notice tone="error">{error}</Notice>}
            {message && <Notice tone="success">{message}</Notice>}
            <SectionTitle>Notion</SectionTitle>
            <Notice>
              {notion?.configured
                ? `Verbinding ingesteld voor pagina ${notion.destinationId}.`
                : 'Nog geen Notion-verbinding ingesteld.'}
            </Notice>
            <p className="text-sm text-ink-2">
              Maak een Notion-verbinding met lees- en invoegrechten en geef deze toegang tot een ouderpagina.
              Per export komt daar een nieuwe checklistpagina onder. Vul het token en de pagina-ID in; de ID
              is een UUID uit de paginalink.
            </p>
            {result.data.canManage ? (
              <form
                className="flex flex-col gap-4 rounded-[20px] bg-surface p-5"
                onSubmit={async (event) => {
                  event.preventDefault()
                  const element = event.currentTarget,
                    form = new FormData(element)
                  setBusy(true)
                  setError(null)
                  setMessage(null)
                  try {
                    const saved = await saveNotionConnectionFn({
                      data: {
                        pageId: String(form.get('pageId')).trim(),
                        token: String(form.get('token')).trim(),
                      },
                    })
                    if (saved.ok) {
                      element.reset()
                      setMessage('Notion-verbinding opgeslagen. Er is nog geen lijst verzonden.')
                      await router.invalidate()
                    } else setError(saved.message)
                  } catch {
                    setError('De verbinding opslaan is niet gelukt. Probeer het opnieuw.')
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                <Field
                  label="Notion-pagina-ID"
                  name="pageId"
                  required
                  defaultValue={notion?.destinationId ?? ''}
                  disabled={busy}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                <Field
                  label="Notion-token"
                  name="token"
                  type="password"
                  required
                  maxLength={5000}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={busy}
                  hint="Het token wordt versleuteld opgeslagen en nooit teruggetoond."
                />
                <Button type="submit" disabled={busy}>
                  Notion-verbinding opslaan
                </Button>
              </form>
            ) : (
              <Notice>Vraag een eigenaar van dit huishouden om de verbinding in te stellen.</Notice>
            )}
            {result.data.canManage && notion?.configured && (
              <Button
                variant="danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  setError(null)
                  setMessage(null)
                  try {
                    const removed = await removeShoppingConnectionFn({ data: { target: 'notion' } })
                    if (removed.ok) {
                      setMessage('Notion-verbinding verwijderd. De exporthistorie blijft bewaard.')
                      await router.invalidate()
                    }
                    if (!removed.ok) setError(removed.message)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                Notion-verbinding verwijderen
              </Button>
            )}
            <AhConnectionForm
              setup={result.data.ah}
              canManage={result.data.canManage}
              configured={Boolean(result.data.targets.find((target) => target.target === 'ah')?.configured)}
            />
          </>
        )}
      </Page>
    </>
  )
}
