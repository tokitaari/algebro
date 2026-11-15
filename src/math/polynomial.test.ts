// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { areEquivalent, polynomialToExpr, toPolynomial } from './normalize'
import { parse } from './parser'
import { compareMonomials } from './polynomial'
import { toText } from './printer'

const P = (input: string) => toPolynomial(parse(input))

describe('Polynomial', () => {
  it('combines like terms and drops zeros', () => {
    const p = P('x^2+3x+2x+6-x^2')
    expect(p.toString()).toBe('5*x+6')
    expect(p.termCount).toBe(2)
    expect(P('x-x').isZero()).toBe(true)
  })

  it('orders terms by degree, then alphabetically', () => {
    expect(P('9+y^2+6xy+x^2').toString()).toBe('x^2+6*x*y+y^2+9')
    expect(P('b^2+a^2+2ab').toString()).toBe('a^2+2*a*b+b^2')
    expect(P('6+2y+3x+xy').toString()).toBe('x*y+3*x+2*y+6')
    expect(compareMonomials([['x', 2]], [['x', 1]])).toBeLessThan(0)
  })

  it('multiplies and raises to powers', () => {
    const a = P('x+3')
    expect(a.mul(P('x-3')).toString()).toBe('x^2-9')
    expect(a.pow(2).toString()).toBe('x^2+6*x+9')
    expect(P('a+b').pow(3).toString()).toBe('a^3+3*a^2*b+3*a*b^2+b^3')
    expect(a.pow(0).toString()).toBe('1')
    expect(() => a.pow(-1)).toThrow(RangeError)
  })

  it('compares by value', () => {
    expect(P('(x+3)^2').equals(P('9+6x+x^2'))).toBe(true)
    expect(P('(x+3)^2').equals(P('x^2+9'))).toBe(false)
  })

  it('reports degree, variables and constants', () => {
    const p = P('3x^2y+y-4')
    expect(p.degree()).toBe(3)
    expect(p.variables()).toEqual(['x', 'y'])
    expect(p.constantValue()).toBeUndefined()
    expect(P('7').constantValue()?.toString()).toBe('7')
    expect(P('x-x').constantValue()?.toString()).toBe('0')
    expect(P('x/2').hasIntegerCoefficients()).toBe(false)
  })

  it('computes the content (greatest common factor)', () => {
    expect(P('6x^2+9x').content().toString()).toBe('3*x')
    expect(P('4x+8').content().toString()).toBe('4')
    expect(P('-4x-8').content().toString()).toBe('4')
    expect(P('6a^2b+9ab^2').content().toString()).toBe('3*a*b')
    expect(P('x/2+1/3').content().toString()).toBe('1/6')
    expect(P('2x+3').isPrimitive()).toBe(true)
    expect(P('x^2+3x').isPrimitive()).toBe(false)
  })

  it('divides by a monomial', () => {
    expect(P('6x^2+9x').divideByMonomial(P('3x')).toString()).toBe('2*x+3')
    expect(() => P('x+1').divideByMonomial(P('x'))).toThrow(RangeError)
    expect(() => P('x+1').divideByMonomial(P('x+1'))).toThrow(RangeError)
  })
})

describe('normalize', () => {
  it('decides equivalence independent of order and notation', () => {
    expect(areEquivalent(parse('9+6x+x^2'), parse('x²+6x+9'))).toBe(true)
    expect(areEquivalent(parse('(a+b)^2'), parse('a^2+b^2'))).toBe(false)
  })

  it('turns polynomials back into canonical expressions', () => {
    expect(toText(polynomialToExpr(P('9+6x+x^2')))).toBe('x² + 6x + 9')
    expect(toText(polynomialToExpr(P('-x^2+x-1')))).toBe('-x² + x - 1')
    expect(toText(polynomialToExpr(P('x-x')))).toBe('0')
    expect(toText(polynomialToExpr(P('-3ab^2')))).toBe('-3ab²')
  })
})
