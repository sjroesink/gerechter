import { expect, test } from 'vitest'
import { openShoppingSecret, sealShoppingSecret } from './shopping-secrets'

test('verbindingsgeheimen zijn versleuteld, willekeurig en gebonden aan sleutel en huishouden', () => {
  const secret = 'test-serversleutel-met-minstens-32-tekens'
  const token = 'ntn_fictief-testgeheim'
  const sealed = sealShoppingSecret(token, secret, 'huis-a')
  expect(sealed).not.toContain(token)
  expect(sealShoppingSecret(token, secret, 'huis-a')).not.toBe(sealed)
  expect(openShoppingSecret(sealed, secret, 'huis-a')).toBe(token)
  expect(() => openShoppingSecret(sealed, secret, 'huis-b')).toThrow(/ontsleuteld/)
  expect(() => openShoppingSecret(sealed, 'andere-serversleutel-met-minstens-32-tekens', 'huis-a')).toThrow(
    /ontsleuteld/,
  )
  const parts = sealed.split('.')
  const cipher = Buffer.from(parts[3]!, 'base64url')
  cipher[0] = cipher[0]! ^ 1
  parts[3] = cipher.toString('base64url')
  expect(() => openShoppingSecret(parts.join('.'), secret, 'huis-a')).toThrow(/ontsleuteld/)
  expect(() => openShoppingSecret('onjuist', secret, 'huis-a')).toThrow(/ontsleuteld/)
  expect(() => sealShoppingSecret(token, 'te-kort', 'huis-a')).toThrow(/serversleutel/)
})
