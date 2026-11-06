import { createFileRoute, Link } from '@tanstack/react-router'
import { MadeRatingForm } from '~/components/made-rating-form'
import { RecipeInstructions } from '~/components/recipe-instructions'
import { DetailHeader, Notice, Page, SectionTitle, buttonClass } from '~/components/ui'
import { formatCalendarDay } from '~/domain/calendar'
import { getMadeEventPage } from '~/server/cooking.functions'

export const Route = createFileRoute('/_app/meer/geschiedenis/$eventId')({
  loader: ({ params }) => getMadeEventPage({ data: params }),
  head: () => ({ meta: [{ title: 'Bereiding · Gerechter' }] }),
  component: EventPage,
})
const number = new Intl.NumberFormat('nl-NL', { maximumSignificantDigits: 8 })
function EventPage() {
  const result = Route.useLoaderData()
  if (!result.ok)
    return (
      <>
        <DetailHeader title="Bereiding" back="/meer/geschiedenis" backLabel="Terug naar gemaakt" />
        <Page>
          <Notice tone="error">{result.message}</Notice>
        </Page>
      </>
    )
  const event = result.data
  return (
    <>
      <DetailHeader
        title={event.snapshot.name}
        subtitle="Gemaakt"
        back="/meer/geschiedenis"
        backLabel="Terug naar gemaakt"
      />
      <Page>
        <section className="flex flex-col gap-1 px-1">
          <h2 className="font-display text-[26px] leading-tight font-bold tracking-tight first-letter:uppercase">
            {formatCalendarDay(event.date)}
          </h2>
          <p className="text-[15px] text-ink-2">
            {event.servings} porties · geregistreerd door {event.actorName}
          </p>
          <p className="text-[13px] text-ink-3">Hieronder staat de receptinhoud van deze bereiding.</p>
        </section>
        <section className="flex flex-col gap-3" aria-label="Bevestigde afboekingen">
          <SectionTitle>Afgeboekt uit voorraad</SectionTitle>
          {event.deductions.length === 0 ? (
            <p className="px-1 text-ink-2">Er is geen voorraad afgeboekt.</p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
              {event.deductions.map((line) => {
                const ingredient = event.snapshot.ingredients.find(
                  (item) => item.ingredientId === line.ingredientId,
                )!
                return (
                  <li
                    key={line.ingredientId}
                    className="flex min-h-14 flex-col justify-center gap-0.5 border-b border-line-soft px-4 py-2 break-words last:border-b-0"
                  >
                    <span className="font-semibold">
                      {number.format(line.quantity)} {ingredient.baseUnit} · {ingredient.name}
                    </span>
                    <span className="text-[13px] text-ink-3">
                      Voorraad bij registratie: {number.format(line.previousQuantity)} →{' '}
                      {number.format(line.remainingQuantity)} {ingredient.baseUnit}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
        <MadeRatingForm eventId={event.id} initial={event.ratings.find((rating) => rating.isMe)} />
        <section className="flex flex-col gap-3" aria-label="Persoonlijke beoordelingen">
          <SectionTitle>Beoordelingen van het huishouden</SectionTitle>
          {event.ratings.length === 0 ? (
            <p className="px-1 text-ink-2">Nog geen beoordelingen.</p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
              {event.ratings.map((rating) => (
                <li
                  key={rating.userId}
                  className="flex items-start gap-3 border-b border-line-soft px-4 py-3 last:border-b-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {rating.userName}
                      {rating.isMe ? ' (jij)' : ''}
                    </span>
                    {rating.note && (
                      <span className="block text-[15px] whitespace-pre-wrap break-words text-ink-2">
                        {rating.note}
                      </span>
                    )}
                  </span>
                  {rating.score !== null && (
                    <span className="shrink-0 text-lg font-bold text-herb">{rating.score}/10</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-3" aria-label="Ingrediënten van de bereiding">
          <SectionTitle>Ingrediënten voor {event.servings} porties</SectionTitle>
          <ul className="flex flex-col overflow-hidden rounded-2xl bg-surface">
            {event.snapshot.ingredients.map((line, index) => (
              <li
                key={index}
                className="flex min-h-12 items-center gap-3 border-b border-line-soft px-4 py-2 break-words last:border-b-0"
              >
                <span className="w-[4.5rem] shrink-0 text-[15px] font-bold">
                  {line.scaledQuantity === null
                    ? 'naar smaak'
                    : `${number.format(line.scaledQuantity)} ${line.unit}`}
                </span>
                <span className="min-w-0 flex-1">
                  {line.name}
                  {line.note && <span className="block text-[13px] text-ink-3">{line.note}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <RecipeInstructions sections={event.snapshot.sections} />
        <Link
          to="/gerechten/$recipeId"
          params={{ recipeId: event.recipeId }}
          className={buttonClass('secondary')}
        >
          Huidig recept bekijken
        </Link>
      </Page>
    </>
  )
}
