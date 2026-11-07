import { createContext } from 'react'

/**
 * Element at the top of the screen where a started kitchen timer shows a compact copy once it is scrolled
 * past. Without a dock (null) timers only render in place.
 */
export const TimerDockContext = createContext<HTMLElement | null>(null)
