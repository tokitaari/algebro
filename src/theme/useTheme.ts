import { useSyncExternalStore } from 'react'
import { chooseTheme, getTheme, subscribeTheme, type Theme } from './theme'

/** The active theme and a setter that applies and stores the learner's choice. */
export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)
  return { theme, setTheme: chooseTheme }
}
