import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockReducedMotion } from '../test/matchMedia'
import { useReducedMotion, useSequencePlayer } from './hooks'
import { animate, delay, ENTER, prefersReducedMotion, runSequence, type SequenceStep } from './motion'

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
  vi.useRealTimers()
})

/** jsdom has no Web Animations API; this records calls and lets a test finish or inspect the animation. */
function fakeAnimatable() {
  let finish: () => void = () => {}
  let fail: (reason: unknown) => void = () => {}
  const animation = {
    finished: new Promise<void>((resolve, reject) => {
      finish = resolve
      fail = reject
    }),
    cancel: vi.fn(() => fail(new DOMException('cancelled', 'AbortError'))),
  }
  const element = document.createElement('div')
  const animateFn = vi.fn(() => animation)
  Object.defineProperty(element, 'animate', { configurable: true, value: animateFn })
  return { element, animateFn, animation, finish: () => finish() }
}

describe('prefersReducedMotion', () => {
  it('is false when the browser cannot tell', () => {
    expect(prefersReducedMotion()).toBe(false)
  })

  it('follows the system setting', () => {
    const system = mockReducedMotion(true)
    expect(prefersReducedMotion()).toBe(true)
    system.set(false)
    expect(prefersReducedMotion()).toBe(false)
  })
})

describe('animate', () => {
  it('resolves at once without the Web Animations API', async () => {
    await expect(animate(document.createElement('div'), ENTER.fade, { duration: 100 })).resolves.toBeUndefined()
    await expect(animate(null, ENTER.fade, { duration: 100 })).resolves.toBeUndefined()
  })

  it('plays the keyframes without a fill mode and resolves when finished', async () => {
    const { element, animateFn, finish } = fakeAnimatable()
    const done = animate(element, ENTER.fromRight, { duration: 200, reducedMotion: false })
    expect(animateFn).toHaveBeenCalledWith([...ENTER.fromRight], expect.objectContaining({ duration: 200, fill: 'none' }))
    finish()
    await expect(done).resolves.toBeUndefined()
  })

  it('skips the animation with reduced motion', async () => {
    mockReducedMotion(true)
    const { element, animateFn } = fakeAnimatable()
    await animate(element, ENTER.fade, { duration: 200 })
    expect(animateFn).not.toHaveBeenCalled()
  })

  it('cancels on abort and still resolves', async () => {
    const { element, animation } = fakeAnimatable()
    const controller = new AbortController()
    const done = animate(element, ENTER.fade, { duration: 200, reducedMotion: false, signal: controller.signal })
    controller.abort()
    await expect(done).resolves.toBeUndefined()
    expect(animation.cancel).toHaveBeenCalled()
  })

  it('does not start when already aborted', async () => {
    const { element, animateFn } = fakeAnimatable()
    const controller = new AbortController()
    controller.abort()
    await animate(element, ENTER.fade, { duration: 200, reducedMotion: false, signal: controller.signal })
    expect(animateFn).not.toHaveBeenCalled()
  })
})

describe('delay', () => {
  it('resolves with true after the time has passed', async () => {
    vi.useFakeTimers()
    const done = delay(300)
    await vi.advanceTimersByTimeAsync(300)
    await expect(done).resolves.toBe(true)
  })

  it('resolves with false when aborted', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const done = delay(300, controller.signal)
    controller.abort()
    await expect(done).resolves.toBe(false)
  })
})

describe('runSequence', () => {
  const recording = () => {
    const log: string[] = []
    const steps: SequenceStep[] = ['a', 'b', 'c'].map((name) => ({ run: () => void log.push(name), pause: 500 }))
    return { log, steps }
  }

  it('runs the steps in order with pauses in between', async () => {
    vi.useFakeTimers()
    const { log, steps } = recording()
    const done = runSequence(steps, { reducedMotion: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(log).toEqual(['a'])
    await vi.advanceTimersByTimeAsync(500)
    expect(log).toEqual(['a', 'b'])
    await vi.advanceTimersByTimeAsync(500)
    await expect(done).resolves.toBe(true)
    expect(log).toEqual(['a', 'b', 'c'])
  })

  it('runs all steps at once with reduced motion', async () => {
    const { log, steps } = recording()
    await expect(runSequence(steps, { reducedMotion: true })).resolves.toBe(true)
    expect(log).toEqual(['a', 'b', 'c'])
  })

  it('stops when aborted', async () => {
    vi.useFakeTimers()
    const { log, steps } = recording()
    const controller = new AbortController()
    const done = runSequence(steps, { reducedMotion: false, signal: controller.signal })
    await vi.advanceTimersByTimeAsync(0)
    controller.abort()
    await expect(done).resolves.toBe(false)
    expect(log).toEqual(['a'])
  })
})

describe('useReducedMotion', () => {
  it('follows changes of the system setting', () => {
    const system = mockReducedMotion(false)
    const { result } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
    act(() => system.set(true))
    expect(result.current).toBe(true)
  })
})

describe('useSequencePlayer', () => {
  it('reports playing while a sequence runs and stops it on request', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSequencePlayer())
    const log: number[] = []
    const steps: SequenceStep[] = [1, 2, 3].map((n) => ({ run: () => void log.push(n), pause: 400 }))
    let done: Promise<boolean> = Promise.resolve(true)
    act(() => {
      done = result.current.play(steps)
    })
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current.playing).toBe(true)
    act(() => result.current.stop())
    await act(async () => {
      await expect(done).resolves.toBe(false)
    })
    expect(result.current.playing).toBe(false)
    expect(log).toEqual([1])
  })

  it('stops a running sequence when unmounted', async () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(() => useSequencePlayer())
    const log: number[] = []
    const steps: SequenceStep[] = [1, 2].map((n) => ({ run: () => void log.push(n), pause: 400 }))
    let done: Promise<boolean> = Promise.resolve(true)
    act(() => {
      done = result.current.play(steps)
    })
    await act(() => vi.advanceTimersByTimeAsync(0))
    unmount()
    await vi.advanceTimersByTimeAsync(1000)
    await expect(done).resolves.toBe(false)
    expect(log).toEqual([1])
  })
})
