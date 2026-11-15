// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  answerChoice,
  answerTerm,
  canGoTo,
  canReveal,
  goTo,
  initialDeckState,
  isDeckComplete,
  lastReachable,
  next,
  previous,
  questionState,
  reveal,
  type DeckState,
} from './deck'
import type { Card } from './types'

const intro: Card = { id: 'intro', title: 'Intro', body: ['Text'] }
const choice: Card = {
  id: 'choice',
  title: 'Auswahl',
  body: ['Text'],
  question: {
    kind: 'choice',
    prompt: 'Wie viele?',
    options: [{ text: '2' }, { text: '4', correct: true }],
  },
}
const term: Card = {
  id: 'term',
  title: 'Term',
  body: ['Text'],
  question: { kind: 'term', prompt: 'Multipliziere aus:', term: '(x+1)(x+2)', answer: 'x^2+3x+2', form: { kind: 'expanded' } },
}
const outro: Card = { id: 'outro', title: 'Ende', body: ['Text'] }
const cards = [intro, choice, term, outro]

describe('navigation', () => {
  it('starts on the first card and can reach the cards up to the first open question', () => {
    const s = initialDeckState()
    expect(s.index).toBe(0)
    expect(lastReachable(cards, s)).toBe(1)
    expect(canGoTo(cards, s, 1)).toBe(true)
    expect(canGoTo(cards, s, 2)).toBe(false)
    expect(canGoTo(cards, s, -1)).toBe(false)
    expect(canGoTo(cards, s, 0.5)).toBe(false)
  })

  it('moves forward and back, but not past an open question', () => {
    let s = next(cards, initialDeckState())
    expect(s.index).toBe(1)
    expect(next(cards, s)).toBe(s)
    s = previous(cards, s)
    expect(s.index).toBe(0)
    expect(previous(cards, s)).toBe(s)
  })

  it('unlocks the next card once the question is solved', () => {
    let s: DeckState = { ...initialDeckState(), index: 1 }
    s = answerChoice(s, choice, 1)
    expect(questionState(s, choice).resolved).toBe('correct')
    expect(lastReachable(cards, s)).toBe(2)
    s = next(cards, s)
    expect(s.index).toBe(2)
  })

  it('jumps back to any reached card', () => {
    let s: DeckState = { ...initialDeckState(), index: 1 }
    s = answerChoice(s, choice, 1)
    s = goTo(cards, s, 2)
    expect(goTo(cards, s, 0).index).toBe(0)
    expect(goTo(cards, s, 3)).toBe(s)
  })

  it('is complete when every question is resolved', () => {
    let s = initialDeckState()
    expect(isDeckComplete(cards, s)).toBe(false)
    s = answerChoice(s, choice, 1)
    s = answerTerm(s, term, 'x^2+3x+2')
    expect(isDeckComplete(cards, s)).toBe(true)
    expect(lastReachable(cards, s)).toBe(3)
    expect(isDeckComplete([intro], initialDeckState())).toBe(true)
  })

  it('handles an empty deck', () => {
    expect(lastReachable([], initialDeckState())).toBe(0)
    expect(canGoTo([], initialDeckState(), 0)).toBe(false)
  })
})

describe('choice questions', () => {
  it('counts a wrong option as a miss and keeps the question open', () => {
    const s = answerChoice(initialDeckState(), choice, 0)
    expect(questionState(s, choice)).toEqual({ resolved: null, misses: 1, feedback: { kind: 'wrong-choice', option: 0 } })
  })

  it('ignores unknown options and answers after the question is resolved', () => {
    const s0 = initialDeckState()
    expect(answerChoice(s0, choice, 5)).toBe(s0)
    const s1 = answerChoice(s0, choice, 1)
    expect(answerChoice(s1, choice, 0)).toBe(s1)
  })

  it('ignores a choice answer for a card without that kind of question', () => {
    const s = initialDeckState()
    expect(answerChoice(s, intro, 0)).toBe(s)
    expect(answerChoice(s, term, 0)).toBe(s)
  })
})

describe('term questions', () => {
  it('accepts any equivalent term in the right form', () => {
    const s = answerTerm(initialDeckState(), term, '2 + 3x + x²')
    expect(questionState(s, term)).toEqual({ resolved: 'correct', misses: 0, feedback: { kind: 'correct' } })
  })

  it('lets the learner try again after a wrong term', () => {
    let s = answerTerm(initialDeckState(), term, 'x^2+2')
    expect(questionState(s, term).resolved).toBeNull()
    expect(questionState(s, term).misses).toBe(1)
    expect(questionState(s, term).feedback).toMatchObject({ kind: 'wrong' })
    s = answerTerm(s, term, 'x^2+3x+2')
    expect(questionState(s, term)).toMatchObject({ resolved: 'correct', misses: 1 })
  })

  it('gives a form hint for an equivalent term in the wrong form and counts it as a miss', () => {
    const s = answerTerm(initialDeckState(), term, '(x+1)(x+2)')
    expect(questionState(s, term)).toMatchObject({ resolved: null, misses: 1, feedback: { kind: 'wrong-form' } })
  })

  it('reports unreadable input without counting a miss', () => {
    const s = answerTerm(initialDeckState(), term, 'x^2+')
    const q = questionState(s, term)
    expect(q.misses).toBe(0)
    expect(q.feedback).toMatchObject({ kind: 'invalid', input: 'x^2+' })
  })
})

describe('reveal', () => {
  it('is offered only after a miss', () => {
    let s = initialDeckState()
    expect(canReveal(s, choice)).toBe(false)
    expect(reveal(s, choice)).toBe(s)
    s = answerChoice(s, choice, 0)
    expect(canReveal(s, choice)).toBe(true)
    s = reveal(s, choice)
    expect(questionState(s, choice)).toMatchObject({ resolved: 'revealed', feedback: { kind: 'revealed' } })
    expect(canReveal(s, choice)).toBe(false)
  })

  it('is not offered for cards without a question', () => {
    expect(canReveal(initialDeckState(), intro)).toBe(false)
  })

  it('unlocks the next card like a solved question', () => {
    let s = answerChoice(initialDeckState(), choice, 0)
    s = reveal(s, choice)
    expect(lastReachable(cards, s)).toBe(2)
  })
})

describe('purity', () => {
  it('does not change the input state', () => {
    const s = initialDeckState()
    answerChoice(s, choice, 1)
    answerTerm(s, term, 'x^2+3x+2')
    expect(s).toEqual({ index: 0, questions: {} })
  })
})
