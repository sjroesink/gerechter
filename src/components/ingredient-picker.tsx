import { useState } from 'react'
import { getCatalog } from '~/server/catalog.functions'
import { Button, Notice } from './ui'
import { IngredientThumbnail } from './ingredient-photo'
import type { IngredientPhoto } from '~/domain/ingredient-photo'

type Choice = { id: string; name: string; photo?: IngredientPhoto | null }
export function IngredientPicker({
  selected,
  choose,
}: {
  selected?: Choice
  choose: (choice: Choice) => void
}) {
  const [open, setOpen] = useState(!selected)
  const [query, setQuery] = useState('')
  const [choices, setChoices] = useState<Choice[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function search() {
    setBusy(true)
    setError(null)
    try {
      const result = await getCatalog({ data: { query, limit: 20, includeArchived: false } })
      setSearched(true)
      if (result.ok) setChoices(result.data)
      else setError(result.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {selected && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold break-words">{selected.name}</span>
          <Button variant="ghost" onClick={() => setOpen(!open)}>
            {open ? 'Zoeken sluiten' : 'Ingrediënt wijzigen'}
          </Button>
        </div>
      )}
      {open && (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">Ingrediënt zoeken</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                if (!busy) void search()
              }}
              maxLength={160}
              placeholder="Bijvoorbeeld rijst"
              className="min-h-12 min-w-0 rounded-full border border-line bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-3 focus:border-tomato focus:ring-2 focus:ring-tomato-soft"
            />
          </label>
          <Button variant="secondary" disabled={busy} onClick={search}>
            {busy ? 'Zoeken…' : 'Zoek ingrediënt'}
          </Button>
          {error && <Notice tone="error">{error}</Notice>}
          {searched && choices.length === 0 && (
            <p className="text-[13px] text-ink-3">Geen passende ingrediënten gevonden.</p>
          )}
          {choices.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-2xl bg-ground p-2">
              {choices.map((item) => (
                <li key={item.id}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start! whitespace-normal text-left"
                    onClick={() => {
                      choose(item)
                      setOpen(false)
                    }}
                  >
                    <IngredientThumbnail photo={item.photo} name={item.name} />
                    <span className="min-w-0 break-words">{item.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
