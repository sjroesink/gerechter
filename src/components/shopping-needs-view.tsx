import { useState, type ReactNode } from 'react'
import type { ShoppingLine, ShoppingNeeds } from '~/domain/shopping-types'
import { AhProductImage, AhProductPicker } from './ah-product-picker'
import { Badge, Button, Notice, SectionTitle } from './ui'
import { IngredientAvatar } from './ingredient-header'

const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 8 })
const listClass = 'flex flex-col overflow-hidden rounded-2xl bg-surface'
const rowClass = 'border-b border-line-soft px-4 py-3 break-words last:border-b-0'

/** With `ah`, each item to buy shows its linked AH product and pack count, or a way to link one. */
export function ShoppingNeedsView({
  needs,
  ah,
}: {
  needs: ShoppingNeeds
  ah?: { onLinked: () => void | Promise<void> }
}) {
  const [picking, setPicking] = useState<string | null>(null)
  return (
    <>
      <Group label="Te kopen">
        {needs.items.length === 0 ? (
          <Notice>Geen boodschappen nodig voor deze selectie.</Notice>
        ) : (
          <ul className={listClass}>
            {needs.items.map((item) => (
              <li key={item.ingredientId} className={`flex items-start gap-3 ${rowClass}`}>
                <IngredientAvatar photo={item.photo} name={item.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="min-w-0 font-semibold break-words">{item.name}</h3>
                    {item.needed > 0 && (
                      <span className="shrink-0 font-bold text-tomato-dark tabular-nums">
                        {number.format(item.needed)} {item.baseUnit}
                        <span className="sr-only"> te kopen</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-ink-3">
                    Nodig: {number.format(item.required)} {item.baseUnit} · in huis:{' '}
                    {number.format(item.available)} {item.baseUnit}
                  </p>
                  {item.unknown.map((line, index) => (
                    <p key={index} className="rounded-xl bg-amber-soft px-3 py-2 text-[13px] text-amber-ink">
                      {line.quantity === null ? 'Naar smaak' : `${number.format(line.quantity)} ${line.unit}`}{' '}
                      · {line.reason}. Controleer dit zelf; er is geen hoeveelheid geraden.
                      {line.note ? ` ${line.note}` : ''}
                    </p>
                  ))}
                  {ah &&
                    (picking === item.ingredientId ? (
                      <AhProductPicker
                        ingredientId={item.ingredientId}
                        ingredientName={item.name}
                        baseUnit={item.baseUnit}
                        onCancel={() => setPicking(null)}
                        onSaved={async () => {
                          setPicking(null)
                          await ah.onLinked()
                        }}
                      />
                    ) : (
                      <AhLine item={item} pick={() => setPicking(item.ingredientId)} />
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Group>
      {needs.staples.length > 0 && (
        <Group label="Basisvoorraad uitgesloten" title="Basisvoorraad · niet toegevoegd">
          <ul className={listClass}>
            {needs.staples.map((item) => (
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
    <div className="flex items-center gap-3 rounded-xl border border-line-soft p-2">
      <AhProductImage url={product.imageUrl} title={product.title} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold break-words">
          <span className="tabular-nums">{product.quantity}×</span> {product.title}
        </p>
        {product.unitSize && <p className="text-[13px] text-ink-3">{product.unitSize}</p>}
      </div>
      {product.check && <Badge tone="amber">aantal controleren</Badge>}
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
