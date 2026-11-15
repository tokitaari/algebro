import { beforeEach, describe, expect, it, vi } from 'vitest'
import { answerChoice, initialDeckState, next, questionState, type DeckState } from './deck'
import { CARDS_STORAGE_KEY, loadDeckState, restoreDeckState, saveDeckState, toStoredDeck } from './storage'
import type { Card, Deck } from './types'

const q = (id: string): Card => ({
  id,
  title: id,
  body: ['Text'],
  question: { kind: 'choice', prompt: 'Frage', options: [{ text: 'a' }, { text: 'b', correct: true }] },
})
const plain = (id: string): Card => ({ id, title: id, body: ['Text'] })

const deck: Deck = { id: 'algebra/terme/ausmultiplizieren', cards: [plain('a'), q('b'), q('c'), plain('d')] }
const other: Deck = { id: 'algebra/terme/faktorisieren', cards: [plain('x'), q('y')] }

beforeEach(() => {
  localStorage.clear()
})

function solved(state: DeckState, cardIndex: number): DeckState {
  return answerChoice(state, deck.cards[cardIndex]!, 1)
}

describe('toStoredDeck / restoreDeckState', () => {
  it('stores nothing at the very start', () => {
    expect(toStoredDeck(deck.cards, initialDeckState())).toBeNull()
  })

  it('stores the current card and the resolved questions by id', () => {
    let s = next(deck.cards, initialDeckState())
    s = solved(s, 1)
    s = next(deck.cards, s)
    expect(toStoredDeck(deck.cards, s)).toEqual({ current: 'c', resolved: { b: 'correct' } })
  })

  it('round-trips the state without feedback and misses', () => {
    let s = next(deck.cards, initialDeckState())
    s = answerChoice(s, deck.cards[1]!, 0)
    s = solved(s, 1)
    s = next(deck.cards, s)
    const restored = restoreDeckState(deck.cards, toStoredDeck(deck.cards, s))
    expect(restored.index).toBe(2)
    expect(questionState(restored, deck.cards[1]!)).toEqual({ resolved: 'correct', misses: 0, feedback: null })
  })

  it('keeps the position reachable when the deck changed', () => {
    // "c" is stored as current, but "b" (before it) is no longer resolved.
    const restored = restoreDeckState(deck.cards, { current: 'c', resolved: {} })
    expect(restored.index).toBe(1)
  })

  it('ignores unknown cards and resolutions of cards without a question', () => {
    const restored = restoreDeckState(deck.cards, { current: 'gone', resolved: { a: 'correct', b: 'revealed', gone: 'correct' } })
    expect(restored.index).toBe(0)
    expect(Object.keys(restored.questions)).toEqual(['b'])
  })
})

describe('saveDeckState / loadDeckState', () => {
  it('starts at the first card', () => {
    expect(loadDeckState(deck)).toEqual(initialDeckState())
  })

  it('survives a reload and keeps decks apart', () => {
    let s = next(deck.cards, initialDeckState())
    s = solved(s, 1)
    expect(saveDeckState(deck, s)).toBe(true)
    expect(saveDeckState(other, next(other.cards, initialDeckState()))).toBe(true)
    expect(loadDeckState(deck)).toEqual({ index: 1, questions: { b: { resolved: 'correct', misses: 0, feedback: null } } })
    expect(loadDeckState(other).index).toBe(1)
  })

  it('stores only card ids and resolutions under its own key', () => {
    saveDeckState(deck, solved(next(deck.cards, initialDeckState()), 1))
    expect(JSON.parse(localStorage.getItem(CARDS_STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      decks: { 'algebra/terme/ausmultiplizieren': { current: 'b', resolved: { b: 'correct' } } },
    })
    expect(localStorage.getItem('lemmio:progress')).toBeNull()
  })

  it('removes the entry when a deck is back at the start', () => {
    saveDeckState(deck, next(deck.cards, initialDeckState()))
    saveDeckState(deck, initialDeckState())
    expect(localStorage.getItem(CARDS_STORAGE_KEY)).toBeNull()
  })

  it.each([
    ['not JSON', '{oops'],
    ['wrong version', JSON.stringify({ version: 2, decks: {} })],
    ['decks not an object', JSON.stringify({ version: 1, decks: [] })],
    ['bad entry', JSON.stringify({ version: 1, decks: { 'algebra/terme/ausmultiplizieren': { current: 3, resolved: {} } } })],
    ['bad card id', JSON.stringify({ version: 1, decks: { 'algebra/terme/ausmultiplizieren': { current: 'B C', resolved: {} } } })],
    ['bad deck id', '{"version":1,"decks":{"__proto__":{"current":"b","resolved":{}}}}'],
  ])('falls back to the start for %s', (_name, raw) => {
    localStorage.setItem(CARDS_STORAGE_KEY, raw)
    expect(loadDeckState(deck)).toEqual(initialDeckState())
  })

  it('drops resolutions it does not know', () => {
    const raw = { version: 1, decks: { 'algebra/terme/ausmultiplizieren': { current: 'c', resolved: { b: 'yes' } } } }
    localStorage.setItem(CARDS_STORAGE_KEY, JSON.stringify(raw))
    expect(loadDeckState(deck)).toEqual({ index: 1, questions: {} })
  })

  it('reports a failed save and keeps working', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(saveDeckState(deck, next(deck.cards, initialDeckState()))).toBe(false)
    spy.mockRestore()
  })
})
