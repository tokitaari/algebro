// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { num } from '../ast'
import type { TermErrorCode } from '../errors'
import { parse } from '../parser'
import { toText } from '../printer'
import { Rational } from '../rational'
import { checkStep } from './check'
import {
  equationForm,
  equationToLatex,
  equationToText,
  parseEquation,
  readEquation,
  solveEquation,
  type EquationForm,
} from './equation'
import { operationProblem, operationToLatex, operationToText, readOperation } from './operation'
import {
  checkSolutionSet,
  readSolutionSet,
  solutionSetToLatex,
  solutionSetToText,
} from './solutionSet'
import { solveStepByStep } from './solve'
import type { Operation, SolutionSet } from './types'

const eq = (input: string) => parseEquation(input)

function operation(input: string): Operation {
  const read = readOperation(input)
  if (!read.ok) throw new Error(`Expected "${input}" to be an operation: ${read.error.message}`)
  return read.operation
}

const single = (value: number): SolutionSet => ({ kind: 'single', value: Rational.of(value) })

describe('parseEquation', () => {
  it.each([
    ['3x + 5 = x + 9', '3x + 5 = x + 9'],
    ['3x+5=x+9', '3x + 5 = x + 9'],
    ['2(x − 3) = 4', '2(x - 3) = 4'],
    ['7 = 2X', '7 = 2x'],
  ])('reads %s', (input, text) => {
    expect(equationToText(eq(input))).toBe(text)
  })

  it.each<[string, TermErrorCode, number]>([
    ['', 'empty', 0],
    ['   ', 'empty', 0],
    ['2x + 3', 'missing-equals', 0],
    ['2x = 3 = 4', 'multiple-equals', 7],
    ['= 3', 'missing-operand', 0],
    ['2x =', 'missing-operand', 3],
    ['2x = 3 +', 'missing-operand', 7],
    ['2x = 3 § 4', 'invalid-character', 7],
    ['2x = 6/x', 'division-by-term', 7],
    ['2x = 6:0', 'division-by-zero', 7],
  ])('rejects "%s" with %s at position %i', (input, code, position) => {
    const read = readEquation(input)
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect([read.error.code, read.error.position]).toEqual([code, position])
    expect(read.error.message.length).toBeGreaterThan(0)
  })

  it('prints LaTeX', () => {
    expect(equationToLatex(eq('x^2 = 4'))).toBe('x^{2} = 4')
  })
})

describe('solveEquation', () => {
  it('finds the single solution', () => {
    expect(solveEquation(eq('2x + 3 = 7'))).toEqual(single(2))
    expect(solveEquation(eq('3(x - 1) = 5x + 7'))).toEqual(single(-5))
    expect(solveEquation(eq('2x = 1'))).toEqual({ kind: 'single', value: Rational.of(1, 2) })
  })

  it('recognises equations without a solution and with every number as a solution', () => {
    expect(solveEquation(eq('2x + 3 = 2x + 5'))).toEqual({ kind: 'empty' })
    expect(solveEquation(eq('2(x + 1) = 2x + 2'))).toEqual({ kind: 'all' })
    expect(solveEquation(eq('3 = 5'))).toEqual({ kind: 'empty' })
    expect(solveEquation(eq('4 = 4'))).toEqual({ kind: 'all' })
  })

  it('ignores terms that cancel and gives up on other equations', () => {
    expect(solveEquation(eq('x^2 + x = x^2 + 3'))).toEqual(single(3))
    expect(solveEquation(eq('x^2 = 4'))).toBeUndefined()
    expect(solveEquation(eq('x + y = 3'))).toBeUndefined()
  })
})

describe('equationForm', () => {
  it.each<[string, EquationForm]>([
    ['x = 3', 'solved'],
    ['x = -3', 'solved'],
    ['x = 1/2', 'solved'],
    ['3 = x', 'solved-swapped'],
    ['0 = 5', 'statement'],
    ['-2 = -2', 'statement'],
    ['2x = 6', 'open'],
    ['x = 6:2', 'open'],
    ['x = 2/4', 'open'],
    ['x = 2 + 1', 'open'],
    ['x + 0 = 3', 'open'],
    ['0x = 5', 'open'],
  ])('%s is %s', (input, form) => {
    expect(equationForm(eq(input))).toBe(form)
  })
})

describe('readOperation', () => {
  it.each([
    ['| + 3x', '| + 3x'],
    ['+3x', '| + 3x'],
    ['| - 5', '| - 5'],
    ['| − 2x', '| - 2x'],
    ['| – 2x', '| - 2x'],
    ['| - (2x + 3)', '| - (2x + 3)'],
    ['| + -3', '| + (-3)'],
    ['| · 4', '| · 4'],
    ['| * 4', '| · 4'],
    ['|·(-2)', '| · (-2)'],
    ['| : 4', '| : 4'],
    ['| / 4', '| : 4'],
    ['| : -2', '| : (-2)'],
    ['| · 1/2', '| · 1/2'],
    ['⇄', '| ⇄'],
    ['| ⇄', '| ⇄'],
    ['| <->', '| ⇄'],
    ['T', '| Term umformen'],
    ['| Term umformen', '| Term umformen'],
  ])('reads "%s" as %s', (input, text) => {
    expect(operationToText(operation(input))).toBe(text)
  })

  it('prints operations that can be read back', () => {
    for (const input of ['| + 3x', '| - (2x + 3)', '| · (-2)', '| : 4', '| ⇄', '| Term umformen']) {
      const text = operationToText(operation(input))
      expect(operationToText(operation(text))).toBe(text)
    }
  })

  it.each<[string, TermErrorCode, number]>([
    ['', 'empty', 0],
    ['|', 'empty', 0],
    ['| 3x', 'missing-operation', 2],
    ['| +', 'missing-operand', 2],
    ['| + 3 +', 'missing-operand', 6],
    ['| - 2x + 3', 'ambiguous-operation', 4],
    ['| · 2 + 3', 'ambiguous-operation', 4],
    ['| + 3 § 4', 'invalid-character', 6],
  ])('cannot read "%s": %s at position %i', (input, code, position) => {
    const read = readOperation(input)
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect([read.reason, read.error.code, read.error.position]).toEqual(['invalid', code, position])
  })

  it.each<[string, TermErrorCode]>([
    ['| · x', 'multiply-by-term'],
    ['| · (x + 1)', 'multiply-by-term'],
    ['| : x', 'division-by-term'],
    ['| : (2x - 1)', 'division-by-term'],
    ['| · 0', 'multiply-by-zero'],
    ['| : 0', 'division-by-zero'],
    ['| : (2 - 2)', 'division-by-zero'],
    ['| + x^2', 'nonlinear-operation'],
    ['| - 2x·x', 'nonlinear-operation'],
  ])('does not allow "%s" and explains why (acceptance criterion 4)', (input, code) => {
    const read = readOperation(input)
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect([read.reason, read.error.code]).toEqual(['not-allowed', code])
    expect(read.error.message.length).toBeGreaterThan(20)
    expect(read.error.position).toBe(4)
  })

  it('reports the same problems for operations built in code', () => {
    expect(operationProblem({ kind: 'multiply', operand: parse('x') })?.code).toBe('multiply-by-term')
    expect(operationProblem({ kind: 'divide', operand: num(0) })?.code).toBe('division-by-zero')
    expect(operationProblem({ kind: 'divide', operand: num(-3) })).toBeUndefined()
    expect(operationProblem({ kind: 'swap' })).toBeUndefined()
    expect(operationProblem({ kind: 'simplify' })).toBeUndefined()
  })

  it('prints LaTeX', () => {
    expect(operationToLatex(operation('| - 3x'))).toBe('\\mid\; {-}\\, 3x')
    expect(operationToLatex(operation('| : (-2)'))).toBe('\\mid\; {:}\\, (-2)')
    expect(operationToLatex({ kind: 'swap' })).toBe('\\mid\; \\rightleftarrows')
    expect(operationToLatex({ kind: 'simplify' })).toBe('\\mid\; \\text{Term umformen}')
  })
})

describe('checkStep (acceptance criterion 4)', () => {
  const start = eq('3x + 5 = x + 9')

  it.each(['2x + 5 = 9', '5 + 2x = 9', '3x + 5 - x = x + 9 - x', '3x - x + 5 = 9', '2x+5=9'])(
    'accepts %s after | - x, however far it is simplified',
    (input) => {
      expect(checkStep(start, operation('| - x'), input).kind).toBe('correct')
    },
  )

  it('returns the parsed line for the next step', () => {
    const result = checkStep(start, operation('| - x'), '2x + 5 = 9')
    expect(result.kind === 'correct' && equationToText(result.equation)).toBe('2x + 5 = 9')
  })

  it('tells which side does not match the operation', () => {
    expect(checkStep(start, operation('| - x'), '2x + 5 = x + 9')).toMatchObject({
      kind: 'wrong',
      left: true,
      right: false,
      keepsSolutions: false,
    })
    expect(checkStep(start, operation('| - x'), '3x + 5 = 9')).toMatchObject({
      kind: 'wrong',
      left: false,
      right: true,
      keepsSolutions: false,
    })
  })

  it('rejects a correct line that does not follow from the stated operation', () => {
    // Two steps at once: − x and − 5.
    expect(checkStep(start, operation('| - x'), '2x = 4')).toMatchObject({
      kind: 'wrong',
      left: false,
      right: false,
      keepsSolutions: true,
    })
  })

  it.each([
    ['2x = 4', '| : 2', 'x = 2'],
    ['2x = 4', '| · 3', '6x = 12'],
    ['-x = 3', '| · (-1)', 'x = -3'],
    ['-3x = 12', '| : (-3)', 'x = -4'],
    ['2x - 4 = 6', '| + 4', '2x = 10'],
    ['2x = 5x - 9', '| - 5x', '-3x = -9'],
    ['4x + 2 = 6', '| : 2', '2x + 1 = 3'],
    ['x + 1 = 3', '| - (x + 1)', '0 = 2 - x'],
  ])('%s %s gives %s', (previous, op, next) => {
    expect(checkStep(eq(previous), operation(op), next).kind).toBe('correct')
  })

  it('catches a forgotten sign and an operation on one side only', () => {
    expect(checkStep(eq('-x = 3'), operation('| · (-1)'), 'x = 3')).toMatchObject({ left: true, right: false })
    expect(checkStep(eq('2x + 4 = 6'), operation('| : 2'), 'x + 4 = 3')).toMatchObject({ left: false, right: true })
  })

  describe('"Term umformen"', () => {
    const previous = eq('2(x + 3) = 4x - 2 + 1')

    it.each(['2x + 6 = 4x - 1', '2x + 6 = 4x - 2 + 1', '2(x + 3) = 4x - 1', '6 + 2x = -1 + 4x'])(
      'accepts %s',
      (input) => {
        expect(checkStep(previous, { kind: 'simplify' }, input).kind).toBe('correct')
      },
    )

    it('needs every side to stay equivalent on its own', () => {
      expect(checkStep(previous, { kind: 'simplify' }, '2x + 3 = 4x - 1')).toMatchObject({
        kind: 'wrong',
        left: false,
        right: true,
      })
      // Equivalent equation, but both sides were changed by an operation.
      expect(checkStep(eq('2x = 4'), { kind: 'simplify' }, 'x = 2')).toMatchObject({
        kind: 'wrong',
        left: false,
        right: false,
        keepsSolutions: true,
      })
    })
  })

  describe('"⇄"', () => {
    const previous = eq('7 = 2x + 1')

    it.each(['2x + 1 = 7', '1 + 2x = 7'])('accepts %s', (input) => {
      expect(checkStep(previous, { kind: 'swap' }, input).kind).toBe('correct')
    })

    it('rejects a line whose sides were not swapped', () => {
      expect(checkStep(previous, { kind: 'swap' }, '7 = 2x + 1')).toMatchObject({
        kind: 'wrong',
        left: false,
        right: false,
        keepsSolutions: true,
      })
    })
  })

  it('reports unreadable lines without judging them', () => {
    const result = checkStep(start, operation('| - x'), '2x + 5')
    expect(result.kind === 'invalid' && result.error.code).toBe('missing-equals')
  })

  it('refuses operations that are not allowed', () => {
    expect(() => checkStep(start, { kind: 'multiply', operand: parse('x') }, '3x^2 + 5x = x^2 + 9x')).toThrow(
      RangeError,
    )
    expect(() => checkStep(start, { kind: 'divide', operand: num(0) }, 'x = 1')).toThrow(RangeError)
  })
})

describe('solution sets (acceptance criterion 5)', () => {
  it.each<[string, SolutionSet]>([
    ['L = {2}', single(2)],
    ['L={-3}', single(-3)],
    ['l = { −4 }', single(-4)],
    ['{2}', single(2)],
    ['L = {0}', single(0)],
    ['L = {1/2}', { kind: 'single', value: Rational.of(1, 2) }],
    ['L = { }', { kind: 'empty' }],
    ['L = {}', { kind: 'empty' }],
    ['∅', { kind: 'empty' }],
    ['L = ℚ', { kind: 'all' }],
    ['L = Q', { kind: 'all' }],
    ['ℚ', { kind: 'all' }],
  ])('reads %s', (input, expected) => {
    const read = readSolutionSet(input)
    expect(read.ok && read.solutionSet).toEqual(expected)
  })

  it.each<[string, TermErrorCode, number]>([
    ['', 'empty', 0],
    ['L = 2', 'invalid-solution-set', 0],
    ['x = 2', 'invalid-solution-set', 0],
    ['L = {2', 'invalid-solution-set', 0],
    ['L = {x}', 'invalid-solution-set', 5],
    ['L = {2;3}', 'invalid-character', 6],
    ['L = {2 +}', 'missing-operand', 7],
  ])('rejects "%s" with %s at position %i', (input, code, position) => {
    const read = readSolutionSet(input)
    expect(read.ok).toBe(false)
    if (read.ok) return
    expect([read.error.code, read.error.position]).toEqual([code, position])
  })

  it.each<[string, SolutionSet, string]>([
    ['L = {2}', single(2), '\\mathbb{L} = \\{2\\}'],
    ['L = {-3}', single(-3), '\\mathbb{L} = \\{-3\\}'],
    ['L = { }', { kind: 'empty' }, '\\mathbb{L} = \\{\\,\\}'],
    ['L = ℚ', { kind: 'all' }, '\\mathbb{L} = \\mathbb{Q}'],
  ])('prints %s and reads it back', (text, set, latex) => {
    expect(solutionSetToText(set)).toBe(text)
    expect(solutionSetToLatex(set)).toBe(latex)
    const read = readSolutionSet(text)
    expect(read.ok && read.solutionSet).toEqual(set)
  })

  it('checks all three cases', () => {
    const one = { solutionSet: single(2) }
    expect(checkSolutionSet(one, 'L = {2}')).toEqual({ kind: 'correct' })
    expect(checkSolutionSet(one, 'L = {4/2}')).toEqual({ kind: 'correct' })
    expect(checkSolutionSet(one, 'L = {-2}')).toEqual({ kind: 'wrong', given: single(-2) })
    expect(checkSolutionSet(one, 'L = { }')).toEqual({ kind: 'wrong', given: { kind: 'empty' } })
    expect(checkSolutionSet(one, 'L = ℚ').kind).toBe('wrong')

    const none = { solutionSet: { kind: 'empty' } as const }
    expect(checkSolutionSet(none, 'L = { }')).toEqual({ kind: 'correct' })
    expect(checkSolutionSet(none, 'L = ℚ').kind).toBe('wrong')
    expect(checkSolutionSet(none, 'L = {0}').kind).toBe('wrong')

    const all = { solutionSet: { kind: 'all' } as const }
    expect(checkSolutionSet(all, 'L = ℚ')).toEqual({ kind: 'correct' })
    expect(checkSolutionSet(all, 'L = { }').kind).toBe('wrong')
    expect(checkSolutionSet(all, 'L = {0}').kind).toBe('wrong')
  })

  it('reports unreadable input without judging it', () => {
    const result = checkSolutionSet({ solutionSet: single(2) }, 'x = 2')
    expect(result.kind === 'invalid' && result.error.code).toBe('invalid-solution-set')
  })
})

describe('solveStepByStep', () => {
  /** Worked solution as `operation → line` strings. */
  function lines(input: string): string[] {
    return solveStepByStep(eq(input)).steps.map((s) => `${operationToText(s.operation)} → ${equationToText(s.equation)}`)
  }

  it('brings the variable to the left, the numbers to the right and divides', () => {
    expect(lines('3x + 5 = x + 9')).toEqual(['| - x → 2x + 5 = 9', '| - 5 → 2x = 4', '| : 2 → x = 2'])
    expect(solveStepByStep(eq('3x + 5 = x + 9')).solutionSet).toEqual(single(2))
  })

  it('swaps the sides if the variable is only on the right', () => {
    expect(lines('7 = 3x - 2')).toEqual(['| ⇄ → 3x - 2 = 7', '| + 2 → 3x = 9', '| : 3 → x = 3'])
  })

  it('removes brackets first, then combines like terms', () => {
    expect(lines('2(x - 3) + 4 = 5x + 7')).toEqual([
      '| Term umformen → 2x - 6 + 4 = 5x + 7',
      '| Term umformen → 2x - 2 = 5x + 7',
      '| - 5x → -3x - 2 = 7',
      '| + 2 → -3x = 9',
      '| : (-3) → x = -3',
    ])
    expect(lines('5x - (2x - 4) = 13')).toEqual([
      '| Term umformen → 5x - 2x + 4 = 13',
      '| Term umformen → 3x + 4 = 13',
      '| - 4 → 3x = 9',
      '| : 3 → x = 3',
    ])
  })

  it('multiplies by -1 instead of dividing by it', () => {
    expect(lines('5 - x = 2')).toEqual(['| Term umformen → -x + 5 = 2', '| - 5 → -x = -3', '| · (-1) → x = 3'])
  })

  it('ends with a false statement if there is no solution', () => {
    const solution = solveStepByStep(eq('2(x + 3) = 2x + 5'))
    expect(lines('2(x + 3) = 2x + 5')).toEqual(['| Term umformen → 2x + 6 = 2x + 5', '| - 2x → 6 = 5'])
    expect(solution.solutionSet).toEqual({ kind: 'empty' })
    expect(solution.solutionNote).toMatch(/^6 = 5 ist eine falsche Aussage/)
  })

  it('ends with a true statement if every number is a solution', () => {
    const solution = solveStepByStep(eq('2x + 3 + x = 3x + 3'))
    expect(lines('2x + 3 + x = 3x + 3')).toEqual(['| Term umformen → 3x + 3 = 3x + 3', '| - 3x → 3 = 3'])
    expect(solution.solutionSet).toEqual({ kind: 'all' })
    expect(solution.solutionNote).toMatch(/^3 = 3 ist eine wahre Aussage/)
  })

  it('explains every step and names the variable', () => {
    const solution = solveStepByStep(eq('2(a - 3) = 5a'))
    expect(solution.variable).toBe('a')
    expect(solution.steps.map((s) => s.note)).toEqual([
      'Klammern auflösen.',
      'Alle Terme mit a auf die linke Seite bringen.',
      'Die Zahlen auf die rechte Seite bringen.',
      'Durch die Zahl vor a teilen.',
    ])
    expect(solution.solutionNote).toBe('Die Gleichung hat genau eine Lösung: a = -2.')
  })

  it('needs no steps for a solved equation and keeps fractions exact', () => {
    expect(lines('x = 4')).toEqual([])
    expect(lines('2x = 1')).toEqual(['| : 2 → x = 1/2'])
    expect(toText(num(Rational.of(1, 2)))).toBe('1/2')
  })

  it('refuses equations that are not linear in one variable', () => {
    expect(() => solveStepByStep(eq('x^2 = 4'))).toThrow(RangeError)
    expect(() => solveStepByStep(eq('x + y = 3'))).toThrow(RangeError)
  })
})
