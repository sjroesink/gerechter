import { describe, expect, test } from 'vitest'
import { isCalendarDate, shiftDate, todayAmsterdam, weekDates } from './calendar'

describe('kalenderdagen', () => {
  test('valideert echte datums en schrikkeljaren zonder normaliseren', () => {
    for (const value of ['2024-02-29', '2000-02-29', '2026-11-05']) expect(isCalendarDate(value)).toBe(true)
    for (const value of [
      '2026-02-29',
      '1900-02-29',
      '2026-02-30',
      '2026-13-01',
      '2026-1-01',
      '2026-01-00',
      '0000-01-01',
      '2026-11-05T00:00:00Z',
    ])
      expect(isCalendarDate(value)).toBe(false)
  })
  test('weken beginnen op maandag en lopen correct over jaar- en zomertijdgrenzen', () => {
    expect(weekDates('2027-01-01')).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])
    expect(shiftDate('2026-03-28', 1)).toBe('2026-03-29')
    expect(shiftDate('2026-03-29', 1)).toBe('2026-03-30')
    expect(shiftDate('2026-10-25', 1)).toBe('2026-10-26')
    expect(weekDates('2026-11-02')[0]).toBe('2026-11-02')
    expect(() => weekDates('2026-02-30')).toThrow()
  })
  test('vandaag gebruikt de Nederlandse kalenderdag onafhankelijk van de serverzone', () => {
    expect(todayAmsterdam(new Date('2026-06-01T22:30:00Z'))).toBe('2026-06-02')
    expect(todayAmsterdam(new Date('2026-12-01T22:30:00Z'))).toBe('2026-12-01')
  })
})
