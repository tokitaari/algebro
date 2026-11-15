// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { TermError, type TermErrorCode } from './errors'
import { toPolynomial } from './normalize'
import { MAX_INPUT_LENGTH, parse } from './parser'

/** Canonical polynomial string of an input, for compact assertions. */
function canon(input: string): string {
  return toPolynomial(parse(input)).toString()
}

function errorOf(input: string): TermError {
  try {
    toPolynomial(parse(input))
  } catch (e) {
    if (e instanceof TermError) return e
    throw e
  }
  throw new Error(`Expected "${input}" to be rejected`)
}

describe('parse: valid input', () => {
  it.each([
    ['x^2+6x+9', 'x^2+6*x+9'],
    ['9+6x+x^2', 'x^2+6*x+9'],
    ['x²+6x+9', 'x^2+6*x+9'],
    ['x ^ 2 + 6 x + 9', 'x^2+6*x+9'],
    ['X^2+6X+9', 'x^2+6*x+9'],
    ['x^(2)', 'x^2'],
    ['x¹²', 'x^12'],
  ])('reads %s', (input, expected) => {
    expect(canon(input)).toBe(expected)
  })

  it.each([
    ['2x', '2*x'],
    ['ab', 'a*b'],
    ['2ab²', '2*a*b^2'],
    ['3(x+1)', '3*x+3'],
    ['x(x+1)', 'x^2+x'],
    ['(x+1)(x-1)', 'x^2-1'],
    ['(x+1)x', 'x^2+x'],
    ['(x+1)²', 'x^2+2*x+1'],
    ['3x(2x+3)', '6*x^2+9*x'],
    ['[x+1][x-1]', 'x^2-1'],
  ])('supports implicit multiplication: %s', (input, expected) => {
    expect(canon(input)).toBe(expected)
  })

  it.each([
    ['2*x', '2*x'],
    ['2·x', '2*x'],
    ['2⋅x', '2*x'],
    ['2×x', '2*x'],
    ['x−3', 'x-3'],
    ['x–3', 'x-3'],
    ['6x/2', '3*x'],
    ['6x:2', '3*x'],
    ['6x÷2', '3*x'],
  ])('accepts operator variants: %s', (input, expected) => {
    expect(canon(input)).toBe(expected)
  })

  it('respects precedence and signs', () => {
    expect(canon('-x^2')).toBe('-x^2')
    expect(canon('(-x)^2')).toBe('x^2')
    expect(canon('-2x+3')).toBe('-2*x+3')
    expect(canon('+x')).toBe('x')
    expect(canon('-(x+1)')).toBe('-x-1')
    expect(canon('2^3x')).toBe('8*x')
    expect(canon('2·3x')).toBe('6*x')
    expect(canon('x-(x-1)')).toBe('1')
    expect(canon('x·(-3)')).toBe('-3*x')
  })

  it('reads decimals and fractions exactly', () => {
    expect(canon('0,5x')).toBe('1/2*x')
    expect(canon('1.5x+0.5x')).toBe('2*x')
    expect(canon('1/2x')).toBe('1/2*x')
    expect(canon('x/2+x/2')).toBe('x')
  })

  it('evaluates to zero and constants', () => {
    expect(canon('x-x')).toBe('0')
    expect(canon('0')).toBe('0')
    expect(canon('2^0')).toBe('1')
  })

  it('records spans of the original input', () => {
    const e = parse('x + (2x)')
    expect(e.type).toBe('add')
    if (e.type !== 'add') return
    expect(e.span).toEqual({ start: 0, end: 8 })
    expect(e.terms[1]?.span).toEqual({ start: 4, end: 8 })
  })
})

describe('parse: invalid input', () => {
  it.each<[string, TermErrorCode, number]>([
    ['', 'empty', 0],
    ['   ', 'empty', 0],
    ['x&2', 'invalid-character', 1],
    ['ä', 'invalid-character', 0],
    ['3,', 'invalid-number', 0],
    ['x+', 'missing-operand', 1],
    ['x*', 'missing-operand', 1],
    ['(x+)', 'missing-operand', 2],
    ['x+-3', 'double-operator', 2],
    ['x*-3', 'double-operator', 2],
    ['*x', 'unexpected-token', 0],
    ['x2', 'missing-operator', 0],
    ['2 3', 'missing-operator', 2],
    ['(x+1)2', 'missing-operator', 5],
    ['x²3', 'missing-operator', 2],
    ['(x+1', 'missing-closing-bracket', 0],
    ['x+1)', 'missing-opening-bracket', 3],
    ['(x+1]', 'mismatched-bracket', 4],
    ['()', 'empty-brackets', 0],
    ['x^-1', 'invalid-exponent', 2],
    ['x^y', 'invalid-exponent', 2],
    ['x^0,5', 'invalid-exponent', 2],
    ['x^', 'invalid-exponent', 2],
    ['x^13', 'exponent-too-large', 2],
    ['x^2^3', 'double-exponent', 3],
    ['x²²²²²²²²²²²²²²²²²²²²', 'exponent-too-large', 1],
    ['x/(x+1)', 'division-by-term', 2],
    ['x/0', 'division-by-zero', 2],
    ['x/(1-1)', 'division-by-zero', 2],
  ])('rejects %j with %s at %i', (input, code, position) => {
    const error = errorOf(input)
    expect(error.code).toBe(code)
    expect(error.position).toBe(position)
    expect(error.message.length).toBeGreaterThan(0)
  })

  it('rejects overly long input', () => {
    expect(errorOf('x+'.repeat(MAX_INPUT_LENGTH)).code).toBe('too-long')
  })

  it('explains the x2 mistake', () => {
    expect(errorOf('x2').message).toContain('x^2')
  })
})
