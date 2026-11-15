/**
 * The two themes of the app. There is no third "system" state: the operating
 * system setting only provides the default until the learner picks a theme.
 */
export type Theme = 'light' | 'dark'

/**
 * localStorage key of the chosen theme. Separate from the practice progress
 * (`lemmio:progress`) so that resetting one never touches the other.
 * The inline script in index.html uses the same key; keep both in sync.
 */
export const THEME_STORAGE_KEY = 'lemmio:theme'

/** Browser UI colour (e.g. the address bar on phones) per theme; equals `--bg` in index.css and the script in index.html. */
export const THEME_COLORS: Record<Theme, string> = { light: '#e9edfb', dark: '#0a1028' }

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

/** localStorage can be missing or throw (private mode, blocked cookies); never let that break the page. */
function getStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** The theme the learner picked earlier, or null if none was stored (or the value is not a valid theme). */
export function readStoredTheme(): Theme | null {
  try {
    const value = getStorage()?.getItem(THEME_STORAGE_KEY)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

/** The theme the operating system asks for; light if the browser cannot tell. */
export function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

/** Stored choice first, then the system setting. */
export function resolveTheme(): Theme {
  return readStoredTheme() ?? systemTheme()
}

const listeners = new Set<() => void>()

/** For `useSyncExternalStore`: called whenever the active theme is (re)applied. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The active theme: what is set on <html> (by the inline script or `applyTheme`), otherwise the resolved default. */
export function getTheme(): Theme {
  const current = document.documentElement.dataset.theme
  return isTheme(current) ? current : resolveTheme()
}

/** Switches the page to a theme without storing anything. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme])
  listeners.forEach((listener) => listener())
}

/** The learner picks a theme: apply it and remember it. It then overrides the system setting. */
export function chooseTheme(theme: Theme): void {
  applyTheme(theme)
  try {
    getStorage()?.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage is full or blocked: the choice still applies for this visit.
  }
}

/**
 * Called once before the first render. The inline script in index.html has
 * normally set the theme already (before the first paint); this makes sure the
 * state is consistent and keeps following the system setting as long as the
 * learner has not picked a theme.
 */
export function initTheme(): void {
  applyTheme(resolveTheme())
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia(DARK_QUERY).addEventListener?.('change', () => {
    if (readStoredTheme() === null) applyTheme(systemTheme())
  })
}
