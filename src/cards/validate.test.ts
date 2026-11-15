// @vitest-environment node
import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { chainToLatex, splitChain, splitMarkup, termToLatex } from '../content/markup'
import { parse, toPolynomial } from '../math'
import { demoDeck } from '../pages/dev/demoDeck'
import type { Card, Deck } from './types'
import { deckMarkup, deckTerms, validateDeck } from './validate'

const deckOf = (...cards: Card[]): Deck => ({ id: 'test/deck/a', cards })
const card = (extra: Partial<Card> = {}): Card => ({ id: 'karte', title: 'Titel', body: ['Text'], ...extra })

function renderStrict(latex: string): void {
  katex.renderToString(latex, { throwOnError: true, strict: 'error' })
}

describe('validateDeck', () => {
  it('accepts a well-formed deck', () => {
    expect(validateDeck(deckOf(card()))).toEqual([])
  })

  it('reports ids, duplicates and missing texts', () => {
    const problems = validateDeck({ id: 'Bad Id', cards: [card({ id: 'a' }), card({ id: 'a', title: ' ', body: [] }), card({ id: 'B' })] })
    expect(problems).toEqual([
      'deck id "Bad Id" must be lower-case segments joined by "/"',
      'card "a": duplicate id',
      'card "a": empty title',
      'card "a": no text',
      'card "B": id must be lower case with hyphens',
    ])
    expect(validateDeck({ id: 'leer', cards: [] })).toEqual(['deck has no cards'])
  })

  it('needs exactly one correct option in a choice question', () => {
    const none = card({ question: { kind: 'choice', prompt: 'P', options: [{ text: 'a' }, { text: 'b' }] } })
    const two = card({ question: { kind: 'choice', prompt: 'P', options: [{ text: 'a', correct: true }, { text: 'b', correct: true }] } })
    const one = card({ question: { kind: 'choice', prompt: 'P', options: [{ text: 'a', correct: true }] } })
    expect(validateDeck(deckOf(none))).toEqual(['card "karte": choice: needs exactly one correct option, has 0'])
    expect(validateDeck(deckOf(two))).toEqual(['card "karte": choice: needs exactly one correct option, has 2'])
    expect(validateDeck(deckOf(one))).toEqual(['card "karte": choice: needs at least two options'])
  })

  it('needs a term question whose model answer passes its own check', () => {
    const wrongForm = card({ question: { kind: 'term', prompt: 'P', answer: '(x+1)^2', form: { kind: 'expanded' } } })
    const broken = card({ question: { kind: 'term', prompt: 'P', answer: 'x+', form: { kind: 'expanded' } } })
    const badKey = card({ question: { kind: 'term', prompt: 'P', answer: 'x', form: { kind: 'expanded' }, variables: ['xy'] } })
    expect(validateDeck(deckOf(wrongForm))).toEqual(['card "karte": term: answer "(x+1)^2" fails its own check (wrong-form)'])
    expect(validateDeck(deckOf(broken))).toEqual(['card "karte": term: answer "x+" does not parse'])
    expect(validateDeck(deckOf(badKey))).toEqual(['card "karte": term: variable key "xy" must be a single lower-case letter'])
  })

  it('needs term steps that parse and stay equivalent to the start', () => {
    const steps = card({
      widget: { kind: 'term-steps', start: '(x+1)^2', steps: [{ term: 'x^2+2x+1' }, { term: 'x^2+1' }, { term: '((' }] },
    })
    expect(validateDeck(deckOf(steps))).toEqual([
      'card "karte": term-steps: "x^2+1" is not equivalent to "(x+1)^2"',
      'card "karte": term-steps: "((" does not parse',
    ])
    expect(validateDeck(deckOf(card({ widget: { kind: 'term-steps', start: 'x', steps: [] } })))).toEqual([
      'card "karte": term-steps: no steps',
    ])
  })
})

describe('area model widget', () => {
  it('reports the problems of the area model with the card', () => {
    const area = card({ widget: { kind: 'area-model', first: ['x', 'x+1'], second: ['-x'], mode: 'expand' } })
    expect(validateDeck(deckOf(area))).toEqual([
      'card "karte": area-model: summand "x+1" must be a single term',
      'card "karte": area-model: second side needs a positive summand',
    ])
    const fine = card({ widget: { kind: 'area-model', first: ['x', '3'], second: ['x', '-5'], mode: 'expand' } })
    expect(validateDeck(deckOf(fine))).toEqual([])
  })
})

describe('deckTerms', () => {
  it('collects widget lines and the terms of term questions', () => {
    const terms = deckTerms(
      deckOf(
        card({ id: 'a', widget: { kind: 'term-steps', start: '(x+1)^2', steps: [{ term: 'x^2+2x+1' }] } }),
        card({ id: 'b', widget: { kind: 'area-model', first: ['x', '3'], second: ['x', '3'], mode: 'factor' } }),
        card({ id: 'c', question: { kind: 'term', prompt: 'P', term: '(x+2)(x+4)', answer: 'x^2+6x+8', form: { kind: 'expanded' } } }),
        card({ id: 'd', widget: { kind: 'area-model', first: [], second: ['x'], mode: 'expand' } }),
      ),
    )
    expect(terms).toEqual(['(x+1)^2', 'x^2+2x+1', '(x + 3)^2', 'x² + 3x + 3x + 9', 'x² + 6x + 9', '3x + 3x', '6x', '(x+2)(x+4)'])
  })
})

describe('deckMarkup', () => {
  it('collects texts, notes, prompts, options, option feedback and explanations', () => {
    const texts = deckMarkup(
      deckOf(
        card({
          body: ['b1', 'b2'],
          widget: { kind: 'term-steps', start: 'x', steps: [{ term: 'x', note: 'n1' }, { term: 'x' }] },
          question: {
            kind: 'choice',
            prompt: 'p',
            options: [{ text: 'o1', feedback: 'f1' }, { text: 'o2', correct: true }],
            explanation: 'e',
          },
        }),
      ),
    )
    expect(texts).toEqual(['b1', 'b2', 'n1', 'p', 'e', 'o1', 'f1', 'o2'])
  })
})

describe('demo deck', () => {
  it('is valid', () => {
    expect(validateDeck(demoDeck)).toEqual([])
  })

  it('only makes true claims and typesets every term', () => {
    for (const text of deckMarkup(demoDeck)) {
      for (const segment of splitMarkup(text)) {
        if (segment.kind !== 'math') continue
        const { terms, relations } = splitChain(segment.source)
        const polys = terms.map((t) => toPolynomial(parse(t)))
        relations.forEach((rel, i) => expect(polys[i]!.equals(polys[i + 1]!), segment.source).toBe(rel === '='))
        expect(() => renderStrict(chainToLatex(segment.source))).not.toThrow()
      }
    }
    for (const term of deckTerms(demoDeck)) {
      expect(() => renderStrict(termToLatex(term)), term).not.toThrow()
    }
  })
})
