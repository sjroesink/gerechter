import { expect, test } from 'vitest'
import { safeRedirect } from './redirect'

test.each([
  [undefined, '/week'],
  ['/meer/huishouden', '/meer/huishouden'],
  ['/meer/huishouden?x=1#y', '/meer/huishouden?x=1#y'],
  ['https://kwaadaardig.example/pad', '/week'],
  ['//kwaadaardig.example/pad', '/week'],
  ['/login?redirect=/week', '/week'],
])('safeRedirect(%s) = %s', (input, expected) => {
  expect(safeRedirect(input)).toBe(expected)
})
