import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { prefersReducedMotion, runSequence, subscribeReducedMotion, type SequenceStep } from './motion'

/** The reduced-motion setting of the system; follows changes while the page is open. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, () => false)
}

/**
 * Plays a sequence (see `runSequence`) that can be stopped. Starting a new
 * sequence stops the running one, and unmounting stops it too, so no step
 * runs on a component that is gone.
 */
export function useSequencePlayer() {
  const reducedMotion = useReducedMotion()
  const controller = useRef<AbortController | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const current = controller
    // Abort whatever runs at unmount time, so the latest value of the ref is wanted here.
    return () => current.current?.abort()
  }, [])

  const stop = useCallback(() => {
    controller.current?.abort()
    controller.current = null
    setPlaying(false)
  }, [])

  const play = useCallback(
    async (steps: readonly SequenceStep[]): Promise<boolean> => {
      controller.current?.abort()
      const own = new AbortController()
      controller.current = own
      setPlaying(true)
      const finished = await runSequence(steps, { reducedMotion, signal: own.signal })
      if (controller.current === own) {
        controller.current = null
        setPlaying(false)
      }
      return finished
    },
    [reducedMotion],
  )

  return { play, stop, playing, reducedMotion }
}
