// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkAnswer, readTerm, type AnswerKey } from './check'
import { checkForm, type FormHintCode, type FormRequirement } from './form'
import { toPolynomial } from './normalize'
import { parse } from './parser'

function key(expected: string, form: FormRequirement): AnswerKey {
  return { expected: toPolynomial(parse(expected)), form }
}

const EXPANDED: FormRequirement = { kind: 'expanded' }

function hintFor(input: string, form: FormRequirement): FormHintCode | undefined {
  return checkForm(parse(input), form)?.code
}

describe('checkAnswer (acceptance criterion 4)', () => {
  const task = key('(x+3)^2', EXPANDED)

  it.each(['x^2+6x+9', 'x²+6x+9', '9+6x+x^2', '6x + x² + 9', 'X^2+6X+9', '9 + x^2 + 6·x'])(
    'accepts %s',
    (input) => {
      expect(checkAnswer(task, input)).toEqual({ kind: 'correct' })
    },
  )

  it('rejects non-equivalent answers', () => {
    expect(checkAnswer(task, 'x^2+9')).toEqual({ kind: 'wrong' }) // (a+b)² ≠ a² + b²
    expect(checkAnswer(task, 'x^2+3x+9')).toEqual({ kind: 'wrong' })
  })

  it('rejects an equivalent answer in the wrong form with a hint', () => {
    const result = checkAnswer(task, '(x+3)(x+3)')
    expect(result.kind).toBe('wrong-form')
    if (result.kind === 'wrong-form') {
      expect(result.hint.code).toBe('has-brackets')
      expect(result.hint.message).toMatch(/Klammern/)
    }
  })

  it('reports unreadable input with position', () => {
    const result = checkAnswer(task, 'x^2+6x+')
    expect(result.kind).toBe('invalid')
    if (result.kind === 'invalid') {
      expect(result.error.code).toBe('missing-operand')
      expect(result.error.position).toBe(6)
    }
  })

  it('checks factored answers', () => {
    const factor = key('(x+3)^2', { kind: 'factored', sumFactors: 2 })
    expect(checkAnswer(factor, '(x+3)^2').kind).toBe('correct')
    expect(checkAnswer(factor, '(3+x)(x+3)').kind).toBe('correct')
    expect(checkAnswer(factor, '(-x-3)^2').kind).toBe('correct')
    expect(checkAnswer(factor, 'x^2+6x+9').kind).toBe('wrong-form')
    expect(checkAnswer(factor, '(x+2)^2').kind).toBe('wrong')
  })
})

describe('readTerm', () => {
  it('returns expression and polynomial or a serialisable error', () => {
    const ok = readTerm('2x+x')
    expect(ok.ok && ok.polynomial.toString()).toBe('3*x')
    const bad = readTerm('2x+')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(JSON.parse(JSON.stringify(bad.error))).toEqual(bad.error)
  })
})

describe('expanded form', () => {
  it.each(['x^2+6x+9', '-x^2-6x', '0', '3', '2ab-b^2', 'x/2+1', '(-3x)+x^2', '1x', '((x^2+1))'])(
    'accepts %s',
    (input) => {
      expect(hintFor(input, EXPANDED)).toBeUndefined()
    },
  )

  it.each<[string, FormHintCode]>([
    ['(x+3)(x+2)', 'has-brackets'],
    ['x(x+1)', 'has-brackets'],
    ['x^2+(2x+3)', 'has-brackets'],
    ['(x+3)^2', 'has-brackets'],
    ['-(x-1)', 'has-brackets'],
    ['(2x)^2', 'unevaluated-power'],
    ['(xy)^2+1', 'unevaluated-power'],
    ['3^2x', 'unevaluated-number'],
    ['2·3x', 'unevaluated-number'],
    ['x·2·3', 'unevaluated-number'],
    ['6x/(1+1)', 'unevaluated-number'],
    ['x·x', 'repeated-variable'],
    ['x^2·x+1', 'repeated-variable'],
    ['x^2+3x+2x+6', 'like-terms'],
    ['x^2+5x+4+2', 'like-terms'],
    ['2xy+3yx', 'like-terms'],
    ['x^2+0x+6', 'zero-term'],
  ])('rejects %s with %s', (input, code) => {
    expect(hintFor(input, EXPANDED)).toBe(code)
  })

  it('reports brackets before less important problems', () => {
    expect(hintFor('(x+1)(x+1)+x+x', EXPANDED)).toBe('has-brackets')
  })
})

describe('factored form', () => {
  const one: FormRequirement = { kind: 'factored', sumFactors: 1 }
  const two: FormRequirement = { kind: 'factored', sumFactors: 2 }

  it.each<[string, FormRequirement]>([
    ['3x(2x+3)', one],
    ['3x·(2x+3)', one],
    ['x·3(3+2x)', one],
    ['-3x(-2x-3)', one],
    ['(3x(2x+3))', one],
    ['4(x+2)', one],
    ['(x+3)^2', two],
    ['(x+3)(x+3)', two],
    ['(x+3)(x-3)', two],
    ['(x-3)(3+x)', two],
    ['2(x+3)^2', two],
    ['-2(x+2)(2-x)', two],
    ['(2a+3b)(2a-3b)', two],
  ])('accepts %s', (input, form) => {
    expect(hintFor(input, form)).toBeUndefined()
  })

  it.each<[string, FormRequirement, FormHintCode]>([
    ['6x^2+9x', one, 'not-a-product'],
    ['3x(2x+3)+0', one, 'not-a-product'],
    ['3x', one, 'not-a-product'],
    ['3(2x^2+3x)', one, 'common-factor-left'],
    ['x(6x+9)', one, 'common-factor-left'],
    ['(6x^2+9x)·1', one, 'common-factor-left'],
    ['3x(x+x+3)', one, 'inner-not-simplified'],
    ['3x((x+1)+2)', one, 'inner-not-simplified'],
    ['(x^2+6x+9)', two, 'not-a-product'],
    ['1·(x^2-9)', two, 'factor-further'],
    ['2(x^2+6x+9)', two, 'factor-further'],
    ['(2x+6)(x+3)', two, 'common-factor-left'],
  ])('rejects %s with %s', (input, form, code) => {
    expect(hintFor(input, form)).toBe(code)
  })
})
