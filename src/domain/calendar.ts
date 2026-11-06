import { z } from 'zod'
import { Invalid } from './core/errors'

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false
  const date = new Date(`${value}T12:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export const calendarDateInput = z
  .string()
  .refine(isCalendarDate, 'Kies een geldige kalenderdatum (JJJJ-MM-DD).')
export function todayAmsterdam(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}
export function shiftDate(value: string, days: number): string {
  if (!isCalendarDate(value) || !Number.isInteger(days)) throw new Invalid('Kies een geldige kalenderdatum.')
  const date = new Date(`${value}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  const result = date.toISOString().slice(0, 10)
  if (!isCalendarDate(result)) throw new Invalid('Deze datum valt buiten de ondersteunde kalender.')
  return result
}
export function weekDates(value: string): string[] {
  if (!isCalendarDate(value)) throw new Invalid('Kies een geldige kalenderdatum.')
  const weekday = new Date(`${value}T12:00:00.000Z`).getUTCDay()
  const monday = shiftDate(value, -((weekday + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index))
}
const dayFormat = new Intl.DateTimeFormat('nl-NL', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
})
export function formatCalendarDay(value: string): string {
  return dayFormat.format(new Date(`${value}T12:00:00.000Z`))
}
