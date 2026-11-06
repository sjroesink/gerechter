import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { Invalid } from './core/errors'

function key(secret: string) {
  if (secret.length < 32) throw new Invalid('De serversleutel voor verbindingen is niet geldig.')
  return createHash('sha256').update('gerechter-shopping-v1\0').update(secret).digest()
}
export function sealShoppingSecret(value: string, secret: string, householdId: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  cipher.setAAD(Buffer.from(`shopping:${householdId}`))
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.')
}
export function openShoppingSecret(value: string, secret: string, householdId: string): string {
  try {
    const [version, iv, tag, encrypted, extra] = value.split('.')
    if (version !== 'v1' || !iv || !tag || !encrypted || extra !== undefined)
      throw new Error('Ongeldig formaat')
    const decipher = createDecipheriv('aes-256-gcm', key(secret), Buffer.from(iv, 'base64url'))
    decipher.setAAD(Buffer.from(`shopping:${householdId}`))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString(
      'utf8',
    )
  } catch {
    throw new Invalid(
      'De verbinding kan niet worden ontsleuteld. Laat de eigenaar het token opnieuw opslaan.',
    )
  }
}
