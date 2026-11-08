import { useEffect, useState, type ReactNode } from 'react'
import { getRecipesPage } from '~/server/recipes.functions'
import { Notice, SearchField, SectionTitle } from './ui'

type Choice = {
  id: string
  name: string
  imageUrl: string | null
  tags: string[]
  prepMinutes: number | null
  cookMinutes: number | null
}

/** Zoekveld met gerechtenlijst; zoekt tijdens het typen. `children` staat tussen zoekveld en lijst. */
export function RecipePicker({
  choose,
  children,
}: {
  choose: (choice: Pick<Choice, 'id' | 'name' | 'imageUrl'>) => void
  children?: ReactNode
}) {
  const [query, setQuery] = useState('')
  const [choices, setChoices] = useState<Choice[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let stale = false
    const timer = setTimeout(
      async () => {
        setBusy(true)
        setError(null)
        try {
          const result = await getRecipesPage({
            data: { query: query.trim(), limit: 30, includeArchived: false },
          })
          if (stale) return
          if (result.ok) setChoices(result.data)
          else setError(result.message)
        } catch {
          if (!stale) setError('Gerechten ophalen is niet gelukt. Probeer het opnieuw.')
        } finally {
          if (!stale) setBusy(false)
        }
      },
      query ? 250 : 0,
    )
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [query])
  return (
    <div className="flex flex-col gap-5">
      <SearchField
        label="Gerecht zoeken"
        placeholder="Zoek gerecht of tag"
        value={query}
        maxLength={160}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.preventDefault()
        }}
        className="min-h-13"
      />
      {children}
      <section className="flex flex-col gap-2.5" aria-label="Gerechten" aria-busy={busy}>
        <SectionTitle>{query.trim() ? 'Resultaten' : 'Gerechten'}</SectionTitle>
        {error && <Notice tone="error">{error}</Notice>}
        {choices === null ? (
          !error && <p className="px-1 text-[15px] text-ink-3">Gerechten laden…</p>
        ) : choices.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-5 text-[15px] text-ink-3">
            {query.trim() ? 'Niets gevonden. Probeer een andere naam of tag.' : 'Nog geen gerechten.'}
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
            {choices.map((item) => {
              const minutes = (item.prepMinutes ?? 0) + (item.cookMinutes ?? 0)
              const meta = [minutes > 0 ? `${minutes} min` : '', ...item.tags].filter(Boolean).join(' · ')
              return (
                <li key={item.id} className="border-b border-line-soft last:border-b-0">
                  <button
                    type="button"
                    onClick={() => choose({ id: item.id, name: item.name, imageUrl: item.imageUrl })}
                    className="flex min-h-15 w-full items-center gap-3 py-2 pr-4 pl-2 text-left text-ink transition-colors hover:bg-ground"
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        loading="lazy"
                        className="size-12 shrink-0 rounded-[10px] bg-muted object-cover"
                      />
                    ) : (
                      <span aria-hidden="true" className="size-12 shrink-0 rounded-[10px] bg-muted" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold break-words">{item.name}</span>
                      {meta && <span className="block truncate text-[13px] text-ink-3">{meta}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
