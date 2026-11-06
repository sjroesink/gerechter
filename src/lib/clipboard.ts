/** Called from a user gesture. Insecure LAN origins can still use the selected-text fallback. */
export async function copyText(text: string, field: HTMLTextAreaElement): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* Fall back to selecting the visible text. */
  }
  field.focus()
  field.select()
  field.setSelectionRange(0, text.length)
  try {
    return document.execCommand('copy')
  } catch {
    return false
  }
}
