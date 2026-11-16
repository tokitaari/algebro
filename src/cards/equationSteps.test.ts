// @vitest-environment node
import katex from 'katex'
import { describe, expect, it } from 'vitest'
import {
  buildEquationSteps,
  describeFrame,
  equationStepsLatex,
  equationStepsProblems,
  equationStepsRows,
  equationStepsTerms,
  frameCount,
  stepsDone,
  stepTotal,
} from './equationSteps'
import type { EquationStepsWidget } from './types'

const widget: EquationStepsWidget = {
  kind: 'equation-steps',
  start: '3x + 2 = x + 8',
  steps: [
    { operation: '| - x', equation: '2x + 2 = 8', note: 'x nach links' },
    { operation: '| - 2', equation: '2x = 6' },
    { operation: '| : 2', equation: 'x = 3' },
  ],
  solution: 'L = {3}',
}

/** Swap and "Term umformen" take one frame each, and there is no solution line. */
const rewriting: EquationStepsWidget = {
  kind: 'equation-steps',
  start: '12 = 3(x + 1)',
  steps: [
    { operation: '⇄', equation: '3(x + 1) = 12' },
    { operation: 'T', equation: '3x + 3 = 12' },
    { operation: '| - 3', equation: '3x = 9' },
    { operation: '| : 3', equation: 'x = 3' },
  ],
}

const withSteps = (steps: EquationStepsWidget['steps'], extra: Partial<EquationStepsWidget> = {}): EquationStepsWidget => ({
  ...widget,
  steps,
  solution: undefined,
  ...extra,
})

describe('equationStepsProblems', () => {
  it('accepts steps that follow from each other and the right solution set', () => {
    expect(equationStepsProblems(widget)).toEqual([])
    expect(equationStepsProblems(rewriting)).toEqual([])
  })

  it('needs a linear start equation and at least one step', () => {
    expect(equationStepsProblems({ ...widget, start: 'x + = 3' })).toEqual(['equation-steps: start "x + = 3" does not parse'])
    expect(equationStepsProblems({ ...widget, start: 'x^2 = 4' })).toEqual([
      'equation-steps: start "x^2 = 4" must be linear in one variable',
    ])
    expect(equationStepsProblems(withSteps([]))).toEqual(['equation-steps: no steps'])
  })

  it('reports operations that are not allowed and lines that do not follow', () => {
    expect(equationStepsProblems(withSteps([{ operation: '| · x', equation: '3x² + 2x = x² + 8x' }]))).toEqual([
      expect.stringMatching(/^equation-steps: operation "\| · x" is not-allowed/),
    ])
    expect(equationStepsProblems(withSteps([{ operation: '| - x', equation: '2x + 2 = 9' }]))).toEqual([
      'equation-steps: "2x + 2 = 9" does not follow from the line before with "| - x" (wrong)',
    ])
    // Two steps at once do not match the stated operation.
    expect(equationStepsProblems(withSteps([{ operation: '| - x', equation: '2x = 6' }]))).toHaveLength(1)
  })

  it('checks the solution set', () => {
    expect(equationStepsProblems({ ...widget, solution: 'L = {4}' })).toEqual([
      'equation-steps: solution "L = {4}" is not L = {3}',
    ])
    expect(equationStepsProblems({ ...widget, solution: 'L = {' })).toEqual(['equation-steps: solution "L = {" does not parse'])
  })
})

describe('frames', () => {
  const model = buildEquationSteps(widget)

  it('takes two frames per arithmetic step and one for the solution set', () => {
    expect(frameCount(model)).toBe(7)
    expect(stepTotal(model)).toBe(4)
    expect([0, 1, 2, 3, 6, 7].map((f) => stepsDone(model, f))).toEqual([0, 0, 1, 1, 3, 4])
  })

  it('starts with the equation alone', () => {
    expect(equationStepsRows(model, 0)).toEqual([{ kind: 'equation', key: 'start', latex: '3x + 2 = x + 8' }])
    expect(describeFrame(model, 0)).toBe('')
  })

  it('first writes the operation next to the line and onto both sides', () => {
    expect(equationStepsRows(model, 1)).toEqual([
      { kind: 'equation', key: 'start', latex: '3x + 2 = x + 8', operation: '\\mid\\; {-}\\, x', note: 'x nach links' },
      {
        kind: 'intermediate',
        key: 'apply-0',
        left: { base: '3x + 2', operand: '{-}\\, x' },
        right: { base: 'x + 8', operand: '{-}\\, x' },
      },
    ])
    expect(describeFrame(model, 1)).toBe('Auf beiden Seiten minus x: 3x + 2 - x = x + 8 - x.')
  })

  it('then replaces the intermediate line with the simplified one', () => {
    expect(equationStepsRows(model, 2).map((r) => r.key)).toEqual(['start', 'step-0'])
    expect(equationStepsRows(model, 2)[1]).toEqual({ kind: 'equation', key: 'step-0', latex: '2x + 2 = 8' })
    expect(describeFrame(model, 2)).toBe('Zusammengefasst: 2x + 2 = 8.')
  })

  it('ends with every operation next to its line and the solution set', () => {
    const rows = equationStepsRows(model, 7)
    expect(rows.map((r) => r.key)).toEqual(['start', 'step-0', 'step-1', 'step-2', 'solution'])
    expect(rows.map((r) => (r.kind === 'equation' ? r.operation : undefined))).toEqual([
      '\\mid\\; {-}\\, x',
      '\\mid\\; {-}\\, 2',
      '\\mid\\; {:}\\, 2',
      undefined,
      undefined,
    ])
    expect(rows[4]).toEqual({ kind: 'solution', key: 'solution', latex: '\\mathbb{L} = \\{3\\}' })
    expect(describeFrame(model, 7)).toBe('Lösungsmenge: L = {3}.')
  })

  it('puts a sum in brackets before dividing and a negative operand in brackets', () => {
    const divide = buildEquationSteps({ kind: 'equation-steps', start: '2x + 4 = 10', steps: [{ operation: '| : 2', equation: 'x + 2 = 5' }] })
    expect(equationStepsRows(divide, 1)[1]).toEqual({
      kind: 'intermediate',
      key: 'apply-0',
      left: { base: '(2x + 4)', operand: '{:}\\, 2' },
      right: { base: '10', operand: '{:}\\, 2' },
    })
    expect(describeFrame(divide, 1)).toBe('Auf beiden Seiten geteilt durch 2: (2x + 4) : 2 = 10 : 2.')

    const negative = buildEquationSteps({ kind: 'equation-steps', start: '-3x = 6', steps: [{ operation: '| : (-3)', equation: 'x = -2' }] })
    const row = equationStepsRows(negative, 1)[1]
    expect(row?.kind === 'intermediate' && row.left.operand).toBe('{:}\\, (-3)')
  })

  it('shows swapping and rewriting in one frame each', () => {
    const swap = buildEquationSteps(rewriting)
    expect(frameCount(swap)).toBe(6)
    expect(stepTotal(swap)).toBe(4)
    expect(equationStepsRows(swap, 1).map((r) => r.kind)).toEqual(['equation', 'equation'])
    expect(describeFrame(swap, 1)).toBe('Seiten tauschen: 3(x + 1) = 12.')
    expect(describeFrame(swap, 2)).toBe('Term umformen: 3x + 3 = 12.')
    expect(describeFrame(swap, 3)).toBe('Auf beiden Seiten minus 3: 3x + 3 - 3 = 12 - 3.')
  })

  it('refuses to build a widget with problems', () => {
    expect(() => buildEquationSteps(withSteps([]))).toThrow(/no steps/)
  })
})

describe('terms and LaTeX', () => {
  it('lists both sides of every line in input syntax', () => {
    expect(equationStepsTerms(widget)).toEqual(['3x + 2', 'x + 8', '2x + 2', '8', '2x', '6', 'x', '3'])
  })

  it('typesets everything with KaTeX in strict mode', () => {
    for (const w of [widget, rewriting]) {
      for (const latex of equationStepsLatex(buildEquationSteps(w))) {
        expect(() => katex.renderToString(latex, { throwOnError: true, strict: 'error' }), latex).not.toThrow()
      }
    }
  })
})
