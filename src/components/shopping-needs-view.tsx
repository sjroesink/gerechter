import { useState, type ReactNode } from 'react'
import type { ShoppingLine, ShoppingNeeds } from '~/domain/shopping-types'
import { AhProductImage, AhProductPicker } from './ah-product-picker'
import { CheckIcon } from './icons'
import { Badge, Button, Notice, SectionTitle, cx } from './ui'
import { IngredientAvatar } from './ingredient-header'

const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 8 })
const listClass = 'flex flex-col overflow-hidden rounded-2xl bg-surface'
const rowClass = 'border-b border-line-soft px-4 py-3 break-words last:border-b-0'

type Selection = {
  skipped: ReadonlySet<string>
  included: ReadonlySet<string>
  toggle: (ingredientId: string) => void
  disabled?: boolean
}

/**
 * With `ah`, each item to buy shows its linked AH product and pack count, or a way to link one.
 * With `selection`, each item to buy gets a checkbox; unchecked items stay off this export. Basic-supply
 * items get one too, unchecked: checking one adds it to this export anyway.
 */
export function ShoppingNeedsView({
  needs,
  ah,
  selection,
}: {
  needs: ShoppingNeeds
  ah?: { onLinked: () => void | Promise<void> }
  selection?: Selection
}) {
  const [picking, setPicking] = useState<string | null>(null)
  const row = (item: ShoppingLine, checked: boolean, idle: string) => (
    <NeedRow
      key={item.ingredientId}
      item={item}
      checked={checked}
      idle={idle}
      selection={selection}
      ah={
        ah && {
          picking: picking === item.ingredientId,
          pick: () => setPicking(item.ingredientId),
          cancel: () => setPicking(null),
          saved: async () => {
            setPicking(null)
            await ah.onLinked()
          },
        }
      }
    />
  )
  return (
    <>
      <Group label="Te kopen">
        {needs.items.length === 0 ? (
          <Notice>Geen boodschappen nodig voor deze selectie.</Notice>
        ) : (
          <ul className={listClass}>
            {needs.items.map((item) =>
              row(item, !selection?.skipped.has(item.ingredientId), 'Al in huis · gaat niet mee'),
            )}
          </ul>
        )}
      </Group>
      {needs.staples.length > 0 && (
        <Group
          label="Basisvoorraad uitgesloten"
          title={selection ? 'Basisvoorraad' : 'Basisvoorraad · niet toegevoegd'}
        >
          <ul className={listClass}>
            {selection
              ? needs.staples.map((item) =>
                  row(
                    item,
                    selection.included.has(item.ingredientId),
                    'Altijd in huis · vink aan om toch te kopen',
                  ),
                )
              : needs.staples.map((item) => (
                  <li key={item.ingredientId} className={`flex items-center gap-3 ${rowClass}`}>
                    <IngredientAvatar photo={item.photo} name={item.name} />
                    <span className="min-w-0 flex-1">{item.name} · altijd in huis</span>
                  </li>
                ))}
          </ul>
        </Group>
      )}
      {needs.covered.length > 0 && (
        <Group label="Voldoende voorraad" title="Voldoende geteld op voorraad">
          <ul className={listClass}>
            {needs.covered.map((item) => (
              <li key={item.ingredientId} className={`flex items-center gap-3 ${rowClass}`}>
                <IngredientAvatar photo={item.photo} name={item.name} />
                <span className="min-w-0 flex-1">
                  {item.name} · {number.format(item.required)} {item.baseUnit} benodigd,{' '}
                  {number.format(item.available)} {item.baseUnit} geteld
                </span>
              </li>
            ))}
          </ul>
        </Group>
      )}
      {needs.ignored.length > 0 && (
        <Group label="Niet meegerekend">
          <ul className={listClass}>
            {needs.ignored.map((item) => (
              <li key={item.id} className={`text-ink-2 ${rowClass}`}>
                {item.title} · {item.reason === 'made' ? 'al gemaakt' : 'vrije maaltijd'}
              </li>
            ))}
          </ul>
        </Group>
      )}
    </>
  )
}

/** An ingredient with its amount, notes and AH product; unchecked it collapses to `idle`. */
function NeedRow({
  item,
  checked,
  idle,
  selection,
  ah,
}: {
  item: ShoppingLine
  checked: boolean
  idle: string
  selection?: Selection
  ah?: { picking: boolean; pick: () => void; cancel: () => void; saved: () => Promise<void> }
}) {
  return (
    <li className={rowClass}>
      <div className="flex items-center gap-3">
        {selection && (
          <label className="relative -my-1 -mr-1 -ml-2.5 flex size-11 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={checked}
              disabled={selection.disabled}
              onChange={() => selection.toggle(item.ingredientId)}
              aria-label={`${item.name} op de lijst zetten`}
              className="peer absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
            />
            <span
              aria-hidden="true"
              className="flex size-6 items-center justify-center rounded-md border-2 border-line bg-surface text-transparent peer-checked:border-tomato peer-checked:bg-tomato peer-checked:text-surface peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tomato peer-disabled:opacity-60"
            >
              <CheckIcon size={16} strokeWidth={3} />
            </span>
          </label>
        )}
        <IngredientAvatar photo={item.photo} name={item.name} />
        <div className={cx('min-w-0 flex-1', !checked && 'opacity-55')}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="min-w-0 font-semibold break-words">{item.name}</h3>
            {checked && item.needed > 0 && (
              <span className="shrink-0 font-bold text-tomato-dark tabular-nums">
                {number.format(item.needed)} {item.baseUnit}
                <span className="sr-only"> te kopen</span>
              </span>
            )}
          </div>
          <p className="text-[13px] text-ink-3">
            {checked
              ? `Nodig: ${number.format(item.required)} ${item.baseUnit} · in huis: ${number.format(item.available)} ${item.baseUnit}`
              : idle}
          </p>
        </div>
      </div>
      {checked && (item.unknown.length > 0 || ah) && (
        <div className="mt-2 flex flex-col gap-2">
          {item.unknown.map((line, index) => (
            <p key={index} className="rounded-xl bg-amber-soft px-3 py-2 text-[13px] text-amber-ink">
              {line.quantity === null ? 'Naar smaak' : `${number.format(line.quantity)} ${line.unit}`} ·{' '}
              {line.reason}. Controleer dit zelf; er is geen hoeveelheid geraden.
              {line.note ? ` ${line.note}` : ''}
            </p>
          ))}
          {ah &&
            (ah.picking ? (
              <AhProductPicker
                ingredientId={item.ingredientId}
                ingredientName={item.name}
                baseUnit={item.baseUnit}
                onCancel={ah.cancel}
                onSaved={ah.saved}
              />
            ) : (
              <AhLine item={item} pick={ah.pick} />
            ))}
        </div>
      )}
    </li>
  )
}

function AhLine({ item, pick }: { item: ShoppingLine; pick: () => void }) {
  const product = item.ahProduct
  if (!product)
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-ink-3">AH: als tekstregel</span>
        <Button variant="secondary" className="min-h-11 px-4" onClick={pick}>
          Koppel product
        </Button>
      </div>
    )
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line-soft p-2 pb-0">
      <AhProductImage url={product.imageUrl} title={product.title} />
      <div className="min-w-0 flex-1">
        <p className="pt-0.5 text-[15px] font-semibold break-words">
          <span className="tabular-nums">{product.quantity}×</span> {product.title}
        </p>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {product.unitSize && <span className="text-[13px] text-ink-3">{product.unitSize}</span>}
            {product.check && <Badge tone="amber">aantal controleren</Badge>}
          </div>
          <Button
            variant="ghost"
            className="min-h-11 shrink-0 px-3"
            aria-label={`Wissel AH-product voor ${item.name}`}
            onClick={pick}
          >
            Wissel
          </Button>
        </div>
      </div>
    </div>
  )
}

function Group({ label, title = label, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={label}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  )
}
