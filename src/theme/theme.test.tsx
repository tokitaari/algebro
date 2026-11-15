import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import indexHtml from '../../index.html?raw'
import ThemeToggle from '../components/ThemeToggle'
import { routes } from '../routes'
import {
  THEME_COLORS,
  THEME_STORAGE_KEY,
  chooseTheme,
  getTheme,
  initTheme,
  readStoredTheme,
  resolveTheme,
  subscribeTheme,
} from './theme'

const root = document.documentElement

/** jsdom has no matchMedia; this stands in for the system setting and lets a test change it. */
function mockSystem(dark: boolean) {
  const listeners: Array<() => void> = []
  const query = {
    matches: dark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, listener: () => void) => {
      listeners.push(listener)
    },
    removeEventListener: () => undefined,
  }
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: () => query })
  return {
    setDark(next: boolean) {
      query.matches = next
      listeners.forEach((listener) => listener())
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  root.removeAttribute('data-theme')
  Reflect.deleteProperty(window, 'matchMedia')
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = THEME_COLORS.light
  document.head.append(meta)
})

afterEach(() => {
  document.head.querySelector('meta[name="theme-color"]')?.remove()
  vi.restoreAllMocks()
})

const themeColor = () => document.head.querySelector('meta[name="theme-color"]')?.getAttribute('content')

describe('theme logic', () => {
  it('follows the system setting when nothing is stored', () => {
    mockSystem(true)
    expect(resolveTheme()).toBe('dark')
    mockSystem(false)
    expect(resolveTheme()).toBe('light')
  })

  it('falls back to light when the browser cannot report the system setting', () => {
    expect(resolveTheme()).toBe('light')
  })

  it('prefers a stored choice over the system setting', () => {
    mockSystem(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    expect(readStoredTheme()).toBe('light')
    expect(resolveTheme()).toBe('light')
  })

  it('ignores stored values that are not a theme', () => {
    mockSystem(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'blue')
    expect(readStoredTheme()).toBeNull()
    expect(resolveTheme()).toBe('dark')
  })

  it('reports the resolved default while no theme has been applied yet', () => {
    mockSystem(true)
    expect(getTheme()).toBe('dark')
  })

  it('applies, stores and announces a chosen theme', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeTheme(listener)
    chooseTheme('dark')
    expect(root.dataset.theme).toBe('dark')
    expect(getTheme()).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(themeColor()).toBe(THEME_COLORS.dark)
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('stores the theme under its own key, apart from the progress', () => {
    expect(THEME_STORAGE_KEY).not.toBe('lemmio:progress')
    localStorage.setItem('lemmio:progress', '{}')
    chooseTheme('dark')
    expect(localStorage.getItem('lemmio:progress')).toBe('{}')
  })

  it('still applies a chosen theme when the browser cannot store it', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(() => chooseTheme('dark')).not.toThrow()
    expect(root.dataset.theme).toBe('dark')
  })

  it('follows later system changes until the learner has chosen a theme', () => {
    const system = mockSystem(false)
    initTheme()
    expect(root.dataset.theme).toBe('light')
    system.setDark(true)
    expect(root.dataset.theme).toBe('dark')
    chooseTheme('light')
    system.setDark(false)
    system.setDark(true)
    expect(root.dataset.theme).toBe('light')
  })
})

describe('inline script in index.html (no flash on load)', () => {
  /** Runs the same script the browser runs in <head>, before React is loaded. */
  function runInlineScript() {
    const match = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)
    if (!match?.[1]) throw new Error('inline theme script not found in index.html')
    new Function(match[1])()
  }

  it('sets the system theme when nothing is stored', () => {
    mockSystem(true)
    runInlineScript()
    expect(root.dataset.theme).toBe('dark')
    expect(themeColor()).toBe(THEME_COLORS.dark)
  })

  it('prefers the stored choice (same key as the app)', () => {
    mockSystem(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    runInlineScript()
    expect(root.dataset.theme).toBe('light')
    expect(themeColor()).toBe(THEME_COLORS.light)
  })

  it('ignores stored values that are not a theme', () => {
    mockSystem(true)
    localStorage.setItem(THEME_STORAGE_KEY, 'blue')
    runInlineScript()
    expect(root.dataset.theme).toBe('dark')
  })

  it('falls back to the system setting when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError')
    })
    mockSystem(true)
    runInlineScript()
    expect(root.dataset.theme).toBe('dark')
  })

  it('falls back to light when the browser cannot report the system setting', () => {
    runInlineScript()
    expect(root.dataset.theme).toBe('light')
  })
})

describe('theme switch', () => {
  it('shows the active theme and switches on click', async () => {
    mockSystem(true)
    render(<ThemeToggle />)
    const group = within(screen.getByRole('group', { name: 'Design' }))
    expect(group.getByRole('button', { name: 'Dunkel' })).toHaveAttribute('aria-pressed', 'true')
    expect(group.getByRole('button', { name: 'Hell' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(group.getByRole('button', { name: 'Hell' }))
    expect(group.getByRole('button', { name: 'Hell' })).toHaveAttribute('aria-pressed', 'true')
    expect(group.getByRole('button', { name: 'Dunkel' })).toHaveAttribute('aria-pressed', 'false')
    expect(root.dataset.theme).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('is part of the page header', () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/'] })} />)
    expect(screen.getByRole('group', { name: 'Design' })).toBeInTheDocument()
  })
})
