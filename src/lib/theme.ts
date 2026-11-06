export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'gerechter.theme'
const CHANGE_EVENT = 'gerechter:theme-change'
const SYSTEM_QUERY = '(prefers-color-scheme: dark)'

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

function storedPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return isThemePreference(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export function getThemePreference(): ThemePreference {
  const value = document.documentElement.dataset.themePreference
  return isThemePreference(value) ? value : 'system'
}

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && matchMedia(SYSTEM_QUERY).matches)
  const root = document.documentElement
  root.dataset.themePreference = preference
  root.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#141211' : '#f3f5f1')
}

export function setThemePreference(preference: ThemePreference) {
  applyTheme(preference)
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // De keuze werkt ook wanneer de browser geen opslag toestaat.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeToTheme(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener)
  return () => window.removeEventListener(CHANGE_EVENT, listener)
}

/** Volg systeemwijzigingen en keuzes uit andere tabbladen zolang de app openstaat. */
export function watchTheme() {
  applyTheme(getThemePreference())
  const media = matchMedia(SYSTEM_QUERY)
  const onSystemChange = () => applyTheme(getThemePreference())
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    applyTheme(storedPreference())
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }
  media.addEventListener('change', onSystemChange)
  window.addEventListener('storage', onStorage)
  return () => {
    media.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** In de head uitvoeren vóór de eerste paint, zodat een donker scherm niet eerst licht flitst. */
export const themeInitScript = `(() => {
  let preference = 'system';
  try {
    const stored = localStorage.getItem('${STORAGE_KEY}');
    if (stored === 'light' || stored === 'dark') preference = stored;
  } catch {}
  const dark = preference === 'dark' || (preference === 'system' && matchMedia('${SYSTEM_QUERY}').matches);
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = dark ? '#141211' : '#f3f5f1';
  document.head.appendChild(meta);
})();`
