import { describe, expect, it } from 'vitest'
import { dayOfMonth, dayTitle, formatWeekRange, isoWeek, weekdayShort } from './planning-dates'

describe('planning-dates', () => {
  it('berekent ISO-weeknummers rond de jaarwisseling', () => {
    expect(isoWeek('2026-11-02')).toBe(45)
    expect(isoWeek('2026-12-28')).toBe(53)
    expect(isoWeek('2027-01-04')).toBe(1)
    expect(isoWeek('2024-12-30')).toBe(1)
    expect(isoWeek('2021-01-03')).toBe(53)
  })

  it('formatteert dagen en weekbereiken in het Nederlands', () => {
    expect(weekdayShort('2026-11-05')).toBe('DO')
    expect(dayOfMonth('2026-11-05')).toBe(5)
    expect(dayTitle('2026-11-05')).toBe('Donderdag 5 november')
    expect(formatWeekRange('2026-11-02', '2026-11-08', '2026-11-05')).toBe('2 – 8 november')
    expect(formatWeekRange('2026-11-30', '2026-12-06', '2026-11-05')).toBe('30 november – 6 december')
    expect(formatWeekRange('2027-01-04', '2027-01-10', '2026-11-05')).toBe('4 – 10 januari 2027')
    expect(formatWeekRange('2026-12-28', '2027-01-03', '2026-11-05')).toBe(
      '28 december 2026 – 3 januari 2027',
    )
  })
})
