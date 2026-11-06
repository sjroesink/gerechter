import { useState, type FormEvent } from 'react'
import type { AhProductLink } from '~/domain/ah-products'
import type { BaseUnit } from '~/domain/units'
import { linkAhProductFn, searchAhProductsFn } from '~/server/ah-products.functions'
import { Badge, Button, Field, Notice, SearchField, cx } from './ui'

type Result = Extract<Awaited<ReturnType<typeof searchAhProductsFn>>, { ok: true }>['data'][number]

const price = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })
const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 8 })

/** Small product image; AH images are hot-linked without a referrer and never required. */
export function AhProductImage({ url, title }: { url: string | null; title: string }) {
  return (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
      {url ? (
        <img
          src={url}
          alt=""
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="size-full object-contain"
        />
      ) : (
        <span aria-hidden className="text-xs font-bold text-ink-3">
          AH
        </span>
      )}
    </span>
  )
}

/** Linked product with its pack contents, as shown on the ingredient page. */
export function AhProductSummary({ link, baseUnit }: { link: AhProductLink; baseUnit: BaseUnit }) {
  return (
    <div className="flex items-center gap-3">
      <AhProductImage url={link.imageUrl} title={link.title} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold break-words">{link.title}</p>
        <p className="text-[13px] text-ink-3">
          {link.packAmount
            ? `Inhoud ${number.format(link.packAmount)} ${baseUnit}`
            : 'Inhoud onbekend · altijd 1 stuk'}
          {link.unitSize ? ` · AH: ${link.unitSize}` : ''}
        </p>
      </div>
    </div>
  )
}

/** Search the AH assortment, pick a product and confirm its pack contents. */
export function AhProductPicker({
  ingredientId,
  ingredientName,
  baseUnit,
  onSaved,
  onCancel,
}: {
  ingredientId: string
  ingredientName: string
  baseUnit: BaseUnit
  onSaved: (link: AhProductLink) => void | Promise<void>
  onCancel: () => void
}) {
  const [query, setQuery] = useState(ingredientName)
  const [results, setResults] = useState<Result[] | null>(null)
  const [chosen, setChosen] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setChosen(null)
    try {
      const res = await searchAhProductsFn({ data: { query, ingredientId } })
      if (res.ok) setResults(res.data)
      else setError(res.message)
    } catch {
      setError('Zoeken bij AH is niet gelukt. Probeer het opnieuw.')
    } finally {
      setBusy(false)
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!chosen) return
    const amount = String(new FormData(event.currentTarget).get('packAmount') ?? '').trim()
    setBusy(true)
    setError(null)
    try {
      const res = await linkAhProductFn({
        data: {
          ingredientId,
          productId: chosen.id,
          title: chosen.title,
          unitSize: chosen.unitSize,
          imageUrl: chosen.imageUrl,
          packAmount: amount ? Number(amount.replace(',', '.')) : null,
        },
      })
      if (res.ok) await onSaved(res.data)
      else setError(res.message)
    } catch {
      setError('Opslaan is niet gelukt. Probeer het opnieuw.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      role="group"
      aria-label="AH-product kiezen"
      className="flex flex-col gap-3 rounded-[20px] bg-surface p-4"
    >
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <SearchField
          label="Zoek bij Albert Heijn"
          className="flex-1"
          value={query}
          maxLength={100}
          required
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" disabled={busy || !query.trim()}>
          {busy && !chosen ? 'Zoeken…' : 'Zoeken'}
        </Button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {results && results.length === 0 && (
        <Notice>Geen producten gevonden. Probeer een andere zoekterm.</Notice>
      )}
      {results && results.length > 0 && !chosen && (
        <ul
          className="flex flex-col overflow-hidden rounded-2xl border border-line-soft"
          aria-label="Zoekresultaten"
        >
          {results.map((product) => (
            <li key={product.id} className="border-b border-line-soft last:border-b-0">
              <button
                type="button"
                onClick={() => setChosen(product)}
                className="flex min-h-16 w-full items-center gap-3 px-3 py-2 text-left hover:bg-ground"
              >
                <AhProductImage url={product.imageUrl} title={product.title} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold break-words">{product.title}</span>
                  <span className="block text-[13px] text-ink-3">
                    {[product.unitSize, product.price !== null ? price.format(product.price) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {product.isBonus && <Badge tone="tomato">{product.bonusLabel ?? 'Bonus'}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {chosen && (
        <form onSubmit={save} className="flex flex-col gap-3">
          <div className={cx('flex items-center gap-3 rounded-2xl border border-line-soft p-3')}>
            <AhProductImage url={chosen.imageUrl} title={chosen.title} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold break-words">{chosen.title}</p>
              {chosen.unitSize && <p className="text-[13px] text-ink-3">AH: {chosen.unitSize}</p>}
            </div>
          </div>
          <Field
            key={chosen.id}
            label={`Inhoud per verpakking in ${baseUnit}`}
            name="packAmount"
            type="number"
            min="0.000000001"
            max="1000000000"
            step="any"
            defaultValue={chosen.suggestedPackAmount ?? ''}
            hint="Hiermee rekent Gerechter het aantal uit. Leeg laten: altijd 1 stuk, met de vraag het aantal te controleren."
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Opslaan…' : 'Product koppelen'}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setChosen(null)}>
              Ander product
            </Button>
          </div>
        </form>
      )}
      <Button variant="ghost" onClick={onCancel} disabled={busy}>
        Annuleren
      </Button>
    </div>
  )
}
