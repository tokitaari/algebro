import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyAnswer, EMPTY_PROGRESS, loadProgress, saveProgress, STORAGE_KEY } from './progress'

beforeEach(() => {
  localStorage.clear()
})

describe('applyAnswer', () => {
  it('counts answers and keeps the last series until a new one completes', () => {
    let p = applyAnswer(EMPTY_PROGRESS, true)
    p = applyAnswer(p, false)
    expect(p).toEqual({ answered: 2, correct: 1, lastSeries: null })
    p = applyAnswer(p, true, { correct: 8, total: 10 })
    expect(p).toEqual({ answered: 3, correct: 2, lastSeries: { correct: 8, total: 10 } })
    expect(applyAnswer(p, false).lastSeries).toEqual({ correct: 8, total: 10 })
  })

  it('does not change its input', () => {
    applyAnswer(EMPTY_PROGRESS, true)
    expect(EMPTY_PROGRESS).toEqual({ answered: 0, correct: 0, lastSeries: null })
  })
})

describe('saveProgress / loadProgress', () => {
  it('starts empty', () => {
    expect(loadProgress('algebra/terme/faktorisieren')).toEqual(EMPTY_PROGRESS)
  })

  it('keeps progress per subtopic and survives a reload', () => {
    const a = { answered: 12, correct: 9, lastSeries: { correct: 8, total: 10 } }
    const b = { answered: 3, correct: 1, lastSeries: null }
    expect(saveProgress('algebra/terme/ausmultiplizieren', a)).toBe(true)
    expect(saveProgress('algebra/terme/faktorisieren', b)).toBe(true)
    expect(loadProgress('algebra/terme/ausmultiplizieren')).toEqual(a)
    expect(loadProgress('algebra/terme/faktorisieren')).toEqual(b)
    expect(loadProgress('algebra/terme/binomische-formeln')).toEqual(EMPTY_PROGRESS)
  })

  it('keeps the progress of equation subtopics next to the term subtopics', () => {
    const p = { answered: 4, correct: 3, lastSeries: null }
    expect(saveProgress('algebra/lineare-gleichungen/sonderfaelle', p)).toBe(true)
    saveProgress('algebra/terme/faktorisieren', p)
    expect(loadProgress('algebra/lineare-gleichungen/sonderfaelle')).toEqual(p)
    expect(loadProgress('algebra/lineare-gleichungen/umformen')).toEqual(EMPTY_PROGRESS)
    expect(loadProgress('algebra/terme/faktorisieren')).toEqual(p)
  })

  it('resetting one subtopic leaves the others and removes the entry when nothing is left', () => {
    const p = { answered: 2, correct: 2, lastSeries: null }
    saveProgress('algebra/terme/ausmultiplizieren', p)
    saveProgress('algebra/terme/faktorisieren', p)
    saveProgress('algebra/terme/ausmultiplizieren', EMPTY_PROGRESS)
    expect(loadProgress('algebra/terme/ausmultiplizieren')).toEqual(EMPTY_PROGRESS)
    expect(loadProgress('algebra/terme/faktorisieren')).toEqual(p)
    saveProgress('algebra/terme/faktorisieren', EMPTY_PROGRESS)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('stores only counts, nothing that identifies the learner', () => {
    saveProgress('algebra/terme/ausmultiplizieren', { answered: 1, correct: 1, lastSeries: null })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      topics: { 'algebra/terme/ausmultiplizieren': { answered: 1, correct: 1, lastSeries: null } },
    })
  })

  it.each([
    ['not JSON', '{oops'],
    ['wrong version', JSON.stringify({ version: 2, topics: {} })],
    ['not an object', '42'],
    ['topics missing', JSON.stringify({ version: 1 })],
  ])('ignores stored data that is %s', (_name, raw) => {
    localStorage.setItem(STORAGE_KEY, raw)
    expect(loadProgress('algebra/terme/ausmultiplizieren')).toEqual(EMPTY_PROGRESS)
  })

  it.each([
    ['more correct than answered', { answered: 1, correct: 2, lastSeries: null }],
    ['negative counts', { answered: -1, correct: 0, lastSeries: null }],
    ['fractions', { answered: 1.5, correct: 1, lastSeries: null }],
    ['strings', { answered: '3', correct: '1', lastSeries: null }],
  ])('ignores an entry with %s', (_name, entry) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, topics: { 'algebra/terme/ausmultiplizieren': entry } }))
    expect(loadProgress('algebra/terme/ausmultiplizieren')).toEqual(EMPTY_PROGRESS)
  })

  it('ignores entries stored under the former flat ids', () => {
    const entry = { answered: 5, correct: 4, lastSeries: null }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, topics: { ausmultiplizieren: entry } }))
    expect(loadProgress('algebra/terme/ausmultiplizieren')).toEqual(EMPTY_PROGRESS)
  })

  it('drops an implausible last series but keeps the counts', () => {
    const entry = { answered: 5, correct: 4, lastSeries: { correct: 11, total: 10 } }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, topics: { 'algebra/terme/ausmultiplizieren': entry } }))
    expect(loadProgress('algebra/terme/ausmultiplizieren')).toEqual({ answered: 5, correct: 4, lastSeries: null })
  })

  it('does not throw when the browser refuses to store', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(saveProgress('algebra/terme/ausmultiplizieren', { answered: 1, correct: 1, lastSeries: null })).toBe(false)
    spy.mockRestore()
  })

  it('does not throw when localStorage is not available at all', () => {
    const spy = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(loadProgress('algebra/terme/ausmultiplizieren')).toEqual(EMPTY_PROGRESS)
    expect(saveProgress('algebra/terme/ausmultiplizieren', { answered: 1, correct: 1, lastSeries: null })).toBe(false)
    spy.mockRestore()
  })
})
