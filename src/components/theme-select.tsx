import { useSyncExternalStore } from 'react'
import { getThemePreference, setThemePreference, subscribeToTheme, type ThemePreference } from '~/lib/theme'

export function ThemeSelect() {
  const preference = useSyncExternalStore(subscribeToTheme, getThemePreference, () => 'system')
  return (
    <label className="flex flex-col gap-2 rounded-[20px] bg-surface p-5">
      <span className="text-[15px] font-semibold">Thema</span>
      <select
        value={preference}
        onChange={(event) => setThemePreference(event.target.value as ThemePreference)}
        className="min-h-12 w-full rounded-2xl border border-line bg-surface px-4 text-base text-ink outline-none focus:border-tomato focus:ring-2 focus:ring-tomato-soft"
      >
        <option value="system">Systeem</option>
        <option value="light">Licht</option>
        <option value="dark">Donker</option>
      </select>
      <span className="text-[13px] text-ink-3">Standaard volgt het thema de instelling van je apparaat.</span>
    </label>
  )
}
