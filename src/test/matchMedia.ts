import { REDUCED_MOTION_QUERY } from '../motion'

/**
 * jsdom has no matchMedia. This stands in for the system's reduced-motion
 * setting (every other media query does not match) and lets a test change it.
 * Remove it again with `Reflect.deleteProperty(window, 'matchMedia')`.
 */
export function mockReducedMotion(reduce: boolean) {
  const listeners = new Set<() => void>()
  let matches = reduce
  const queryFor = (media: string) => ({
    get matches() {
      return media === REDUCED_MOTION_QUERY && matches
    },
    media,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  })
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: queryFor })
  return {
    set(next: boolean) {
      matches = next
      listeners.forEach((listener) => listener())
    },
    listenerCount: () => listeners.size,
  }
}
