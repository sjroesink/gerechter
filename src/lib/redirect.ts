/** Alleen interne paden toestaan als doel na het inloggen (geen open redirect). */
export function safeRedirect(target: string | undefined, fallback = '/week'): string {
  if (!target) return fallback
  try {
    const url = new URL(target, 'http://intern.invalid')
    if (url.origin !== 'http://intern.invalid') return fallback
    const path = `${url.pathname}${url.search}${url.hash}`
    return path.startsWith('/login') ? fallback : path
  } catch {
    return fallback
  }
}
