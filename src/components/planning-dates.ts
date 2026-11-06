import { formatCalendarDay } from '~/domain/calendar'

const at = (value: string) => new Date(`${value}T12:00:00.000Z`)
const weekdayFormat = new Intl.DateTimeFormat('nl-NL', { weekday: 'short', timeZone: 'UTC' })
const monthFormat = new Intl.DateTimeFormat('nl-NL', { month: 'long', timeZone: 'UTC' })

/** Afgekorte weekdag in hoofdletters, bijvoorbeeld "MA". */
export function weekdayShort(value: string) {
  return weekdayFormat.format(at(value)).replace('.', '').slice(0, 2).toUpperCase()
}

export function dayOfMonth(value: string) {
  return Number(value.slice(8, 10))
}

/** "Donderdag 5 november" */
export function dayTitle(value: string) {
  const text = formatCalendarDay(value)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** ISO-weeknummer: de week waarin de donderdag valt. */
export function isoWeek(value: string) {
  const date = at(value)
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7))
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1, 12)
  return Math.floor((date.getTime() - yearStart) / 86_400_000 / 7) + 1
}

/** "2 – 8 november", "28 december 2026 – 3 januari 2027"; het jaar alleen buiten het huidige jaar. */
export function formatWeekRange(start: string, end: string, today: string) {
  const [startYear, endYear, thisYear] = [start, end, today].map((value) => value.slice(0, 4))
  const startMonth = monthFormat.format(at(start))
  const endMonth = monthFormat.format(at(end))
  const endText = `${dayOfMonth(end)} ${endMonth}${endYear !== thisYear || startYear !== endYear ? ` ${endYear}` : ''}`
  if (startYear !== endYear) return `${dayOfMonth(start)} ${startMonth} ${startYear} – ${endText}`
  if (startMonth !== endMonth) return `${dayOfMonth(start)} ${startMonth} – ${endText}`
  return `${dayOfMonth(start)} – ${endText}`
}
