import { useEffect, useRef, useState } from 'react'

/**
 * Zoektekst die met vertraging naar de URL gaat; Enter past hem direct toe. Een gewijzigde
 * URL (terug-knop) overschrijft de tekst alleen als die niet van dit veld zelf kwam.
 */
export function useSearchText(query: string, apply: (query: string) => unknown, delay = 300) {
  const [text, setText] = useState(query)
  const sent = useRef(query)
  function submit(value = text) {
    sent.current = value
    void apply(value)
  }
  useEffect(() => {
    if (query === sent.current) return
    sent.current = query
    setText(query)
  }, [query])
  useEffect(() => {
    if (text === sent.current) return
    const timer = setTimeout(() => submit(text), delay)
    return () => clearTimeout(timer)
  })
  return { text, setText, submit }
}
