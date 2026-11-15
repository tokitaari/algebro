// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parse, toPolynomial } from '../math'
import {
  applyAreaStep,
  areaFrame,
  areaHandles,
  areaLines,
  areaModelProblems,
  areaModelTerms,
  areaStepCount,
  buildAreaModel,
  cellFactors,
  clampLength,
  describeStep,
  displayTerm,
  evaluate,
  handlePosition,
  initialAreaValues,
  initialReveal,
  layoutAreaModel,
  lengthRange,
  maxExtents,
  nextAreaStep,
  numericCheck,
  remainingSteps,
  sideText,
  solveHandle,
  type AreaHandle,
  type AreaModel,
} from './areaModel'
import type { AreaModelWidget } from './types'

const widget = (first: string[], second: string[], extra: Partial<AreaModelWidget> = {}): AreaModelWidget => ({
  kind: 'area-model',
  first,
  second,
  mode: 'expand',
  ...extra,
})

const model = (first: string[], second: string[], extra: Partial<AreaModelWidget> = {}) =>
  buildAreaModel(widget(first, second, extra))

const poly = (term: string) => toPolynomial(parse(term))

/** True if every term of a chain like "a = b = c" parses and all are equal. */
function chainHolds(chain: string): boolean {
  const [first, ...rest] = chain.split(' = ').map(poly)
  return first !== undefined && rest.every((p) => p.equals(first))
}

const square = (lengths: AreaModelWidget['lengths'], mode: AreaModelWidget['mode'] = 'expand') =>
  model(['a', '-b'], ['a', '-b'], { mode, lengths })

const exploreSquare = () => square({ a: { value: 6, min: 4, max: 9 }, b: { value: 2, min: 1, max: 3 } }, 'explore')

/** Signed sum of all partial areas: strips count negative, corners positive. */
function signedArea(m: AreaModel, values: Record<string, number>): number {
  const layout = layoutAreaModel(m, values)
  return m.cells.reduce((sum, cell) => {
    const rect = layout.cells[cell.index]!.rect
    return sum + (cell.negatives === 1 ? -1 : 1) * rect.width * rect.height
  }, 0)
}

describe('cells and lines', () => {
  it('multiplies every summand with every summand and combines like terms', () => {
    const m = model(['x', '3'], ['x', '-5'])
    expect(m.cells.map((c) => c.text)).toEqual(['x²', '-5x', '3x', '-15'])
    expect(m.cells.map((c) => c.negatives)).toEqual([0, 1, 0, 1])
    expect(m.cells.map((c) => c.group)).toEqual([null, 0, 0, null])
    expect(m.product).toBe('(x + 3)(x - 5)')
    expect(m.expanded).toBe('x² - 5x + 3x - 15')
    expect(m.combined).toBe('x² - 2x - 15')
    expect(m.groups).toEqual([{ symbol: '●', cells: [1, 2], terms: '-5x + 3x', result: '-2x', cancels: false }])
  })

  it('writes equal factors as a power', () => {
    const m = model(['x', '3'], ['x', '3'])
    expect(m.square).toBe(true)
    expect(m.product).toBe('(x + 3)^2')
    expect(m.groups.map((g) => [g.terms, g.result])).toEqual([['3x + 3x', '6x']])
    expect(m.combined).toBe('x² + 6x + 9')
    expect(model(['3x'], ['3x']).product).toBe('(3x)^2')
    expect(model(['x'], ['x']).product).toBe('x^2')
    expect(model(['x', '3'], ['3', 'x']).square).toBe(false)
  })

  it('shows cancelling terms of the third binomial formula', () => {
    const m = model(['a', 'b'], ['a', '-b'])
    expect(m.cells.map((c) => c.text)).toEqual(['a²', '-ab', 'ab', '-b²'])
    expect(m.groups).toEqual([{ symbol: '●', cells: [1, 2], terms: '-ab + ab', result: '0', cancels: true }])
    expect(m.combined).toBe('a² - b²')
  })

  it('handles a single factor in front of a bracket', () => {
    const m = model(['3x'], ['2x', '3'])
    expect(m.product).toBe('3x(2x + 3)')
    expect(m.cells.map((c) => c.text)).toEqual(['6x²', '9x'])
    expect(m.groups).toEqual([])
    expect(m.combined).toBe('6x² + 9x')
  })

  it('writes products that parse', () => {
    expect(model(['x', '1'], ['2']).product).toBe('(x + 1)·2')
    expect(model(['2'], ['x', '1']).product).toBe('2(x + 1)')
    expect(model(['a', 'b'], ['c', 'd']).product).toBe('(a + b)(c + d)')
  })

  it('only produces lines that are equivalent to the product', () => {
    const models = [
      model(['x', '3'], ['x', '-5']),
      model(['a', '-b'], ['a', '-b']),
      model(['2x', 'y', '-1'], ['x', '-3']),
      model(['x', '1'], ['2']),
      model(['-2', 'x'], ['x']),
    ]
    for (const m of models) {
      const product = poly(m.product)
      for (const term of [m.expanded, m.combined]) expect(poly(term).equals(product), term).toBe(true)
      for (const g of m.groups) expect(chainHolds(`${g.terms} = ${g.result}`), g.terms).toBe(true)
      for (const term of areaModelTerms(m)) expect(() => parse(term), term).not.toThrow()
    }
  })

  it('has texts for display and screen readers', () => {
    const m = model(['x', '3'], ['x', '-5'])
    expect(displayTerm('(x - 3)^2')).toBe('(x − 3)²')
    expect(cellFactors(m, m.cells[1]!)).toBe('x mal (−5)')
    expect(sideText(m, 1)).toBe('x − 5')
  })
})

describe('problems', () => {
  it('accepts valid widgets', () => {
    expect(areaModelProblems(widget(['x', '3'], ['x', '-5']))).toEqual([])
    expect(areaModelProblems(widget(['x^2', 'ab'], ['3'], { mode: 'factor' }))).toEqual([])
    expect(areaModelProblems(widget(['a', '-b'], ['a', '-b'], { mode: 'explore', lengths: { a: { value: 6, min: 4, max: 9 }, b: { value: 2, min: 1, max: 3 } } }))).toEqual([])
  })

  it('needs one to three summands per side', () => {
    expect(areaModelProblems(widget([], ['x']))).toEqual(['area-model: first side needs 1 to 3 summands'])
    expect(areaModelProblems(widget(['x'], ['a', 'b', 'c', 'd']))).toEqual(['area-model: second side needs 1 to 3 summands'])
  })

  it('needs single non-zero terms with integer coefficients', () => {
    expect(areaModelProblems(widget(['x'], ['x+', 'x+1', '0']))).toEqual([
      'area-model: summand "x+" does not parse',
      'area-model: summand "x+1" must be a single term',
      'area-model: summand "0" must not be zero',
    ])
    expect(areaModelProblems(widget(['x/2'], ['x']))).toEqual(['area-model: summand "x/2" needs an integer coefficient'])
  })

  it('needs a positive summand and no like terms on a side', () => {
    expect(areaModelProblems(widget(['-x'], ['x']))).toEqual(['area-model: first side needs a positive summand'])
    expect(areaModelProblems(widget(['x', '2x'], ['x']))).toEqual(['area-model: first side has like terms "x" and "2x"'])
  })

  it('needs matching lengths to draw to scale', () => {
    expect(areaModelProblems(widget(['a'], ['b'], { mode: 'explore' }))).toEqual(['area-model: explore needs lengths'])
    expect(areaModelProblems(widget(['x^2', '3'], ['y'], { lengths: { y: { value: 2 }, z: { value: 1 } } }))).toEqual([
      'area-model: summand "x²" cannot be drawn to scale',
      'area-model: length for "z" is not used',
    ])
    expect(areaModelProblems(widget(['a', 'b'], ['a'], { lengths: { a: { value: 2 } } }))).toEqual(['area-model: no length for "b"'])
  })

  it('needs integer lengths within their range', () => {
    expect(areaModelProblems(widget(['a'], ['a'], { lengths: { a: { value: 2.5 } } }))).toEqual([
      'area-model: length of "a" needs an integer value ≥ 1',
    ])
    expect(areaModelProblems(widget(['a'], ['a'], { mode: 'explore', lengths: { a: { value: 5, min: 6, max: 9 } } }))).toEqual([
      'area-model: length of "a" needs integers with 1 ≤ min ≤ value ≤ max',
    ])
    expect(areaModelProblems(widget(['a'], ['a'], { mode: 'explore', lengths: { a: { value: 5 } } }))).toEqual([
      'area-model: length of "a" needs integers with 1 ≤ min ≤ value ≤ max',
    ])
  })

  it('needs sides that stay longer than their strips for every length', () => {
    const lengths = { a: { value: 5, min: 3, max: 9 }, b: { value: 2, min: 1, max: 3 } }
    expect(areaModelProblems(widget(['a', '-b'], ['a'], { mode: 'explore', lengths }))).toEqual([
      'area-model: first side must stay longer than its cut-off strips for every length',
    ])
    expect(areaModelProblems(widget(['a'], ['2', '-a'], { lengths: { a: { value: 2 } } }))).toEqual([
      'area-model: second side must stay longer than its cut-off strips for every length',
    ])
  })

  it('refuses to build a model with problems', () => {
    expect(() => buildAreaModel(widget([], ['x']))).toThrow('first side needs 1 to 3 summands')
  })
})

describe('geometry', () => {
  it('sketches terms with a variable longer than numbers and cuts strips off the end', () => {
    const layout = layoutAreaModel(model(['x', '3'], ['x', '-5']), {})
    const [rows, cols] = layout.sides
    expect(rows.total).toBe(3)
    expect(rows.kept).toBe(3)
    expect(rows.parts.map((p) => p.span)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 3 },
    ])
    expect(cols.total).toBe(2)
    expect(cols.kept).toBeCloseTo(1.2)
    expect(cols.parts[1]!.span.start).toBeCloseTo(1.2)
    expect(cols.parts[1]!.span.end).toBeCloseTo(2)
    expect(cols.parts[0]!.visible!.end).toBeCloseTo(1.2)
  })

  it('draws (a − b)² as the square a² with two strips and the corner', () => {
    const m = square({ a: { value: 6 }, b: { value: 2 } })
    const layout = layoutAreaModel(m, { a: 6, b: 2 })
    expect(layout.sides.map((s) => [s.total, s.kept])).toEqual([
      [6, 4],
      [6, 4],
    ])
    expect(layout.cells).toEqual([
      { rect: { x: 0, y: 0, width: 6, height: 6 }, label: { x: 0, y: 0, width: 4, height: 4 } },
      { rect: { x: 4, y: 0, width: 2, height: 6 }, label: { x: 4, y: 0, width: 2, height: 4 } },
      { rect: { x: 0, y: 4, width: 6, height: 2 }, label: { x: 0, y: 4, width: 4, height: 2 } },
      { rect: { x: 4, y: 4, width: 2, height: 2 }, label: { x: 4, y: 4, width: 2, height: 2 } },
    ])
  })

  it('keeps the signed sum of the partial areas equal to the kept rectangle', () => {
    const cases: [AreaModel, Record<string, number>][] = [
      [square({ a: { value: 6 }, b: { value: 2 } }), { a: 6, b: 2 }],
      [model(['a', 'b'], ['a', '-b'], { lengths: { a: { value: 5 }, b: { value: 2 } } }), { a: 5, b: 2 }],
      [model(['2x', 'y', '-3'], ['x', '-1'], { lengths: { x: { value: 4 }, y: { value: 2 } } }), { x: 4, y: 2 }],
    ]
    for (const [m, values] of cases) {
      const layout = layoutAreaModel(m, values)
      expect(signedArea(m, values)).toBeCloseTo(layout.sides[0].kept * layout.sides[1].kept)
      expect(signedArea(m, values)).toBe(numericCheck(m, values).area)
    }
  })

  it('puts labels of fully cut-off parts on the whole part', () => {
    const m = model(['a', '1', '-b'], ['a'], { lengths: { a: { value: 3 }, b: { value: 2 } } })
    const layout = layoutAreaModel(m, { a: 3, b: 2 })
    expect(layout.sides[0].parts.map((p) => p.visible)).toEqual([{ start: 0, end: 2 }, null, { start: 2, end: 4 }])
    expect(layout.cells[1]!.label).toEqual(layout.cells[1]!.rect)
  })

  it('fits the longest allowed sides into the frame', () => {
    const m = exploreSquare()
    expect(maxExtents(m)).toEqual([9, 9])
    const frame = areaFrame(m)
    expect(frame.scale).toBeCloseTo(280 / 9)
    expect(frame.view.x).toBe(-48)
    expect(frame.view.y).toBe(-32)
    expect(frame.view.width).toBeCloseTo(376)
    expect(frame.view.height).toBeCloseTo(344)
    // Without cut-off strips there is only a small margin on the right and at the bottom.
    const plain = areaFrame(model(['x', '3'], ['x', '5'])).view
    expect(plain.width).toBeCloseTo(344)
    expect(plain.height).toBeCloseTo(328)
  })
})

describe('handles', () => {
  it('has a handle per variable summand in explore mode only', () => {
    expect(areaHandles(exploreSquare())).toEqual([
      { side: 0, part: 0, variable: 'a', negative: false },
      { side: 0, part: 1, variable: 'b', negative: true },
      { side: 1, part: 0, variable: 'a', negative: false },
      { side: 1, part: 1, variable: 'b', negative: true },
    ])
    expect(areaHandles(square({ a: { value: 6 }, b: { value: 2 } }))).toEqual([])
  })

  it('sits at the end of a segment or the inner edge of a strip', () => {
    const m = exploreSquare()
    const [a, b] = areaHandles(m) as [AreaHandle, AreaHandle]
    const layout = layoutAreaModel(m, initialAreaValues(m))
    expect(handlePosition(layout, a)).toBe(6)
    expect(handlePosition(layout, b)).toBe(4)
  })

  it('turns a drag position into a length within the range', () => {
    const m = exploreSquare()
    const values = initialAreaValues(m)
    expect(values).toEqual({ a: 6, b: 2 })
    const [a, b] = areaHandles(m) as [AreaHandle, AreaHandle]
    expect(solveHandle(m, values, a, 7.4)).toBeCloseTo(7.4)
    expect(solveHandle(m, values, b, 3)).toBeCloseTo(3)
    expect(lengthRange(m, 'a')).toEqual([4, 9])
    expect(clampLength(m, 'a', 7.4)).toBe(7)
    expect(clampLength(m, 'a', 100)).toBe(9)
    expect(clampLength(m, 'b', -5)).toBe(1)
  })

  it('takes the coefficient into account', () => {
    const m = model(['2x', '1'], ['x'], { mode: 'explore', lengths: { x: { value: 3, min: 1, max: 5 } } })
    const [left, top] = areaHandles(m) as [AreaHandle, AreaHandle]
    expect(solveHandle(m, { x: 3 }, left, 8)).toBeCloseTo(4)
    expect(solveHandle(m, { x: 3 }, top, 8)).toBeCloseTo(8)
  })

  it('checks the formula with numbers', () => {
    const m = exploreSquare()
    expect(evaluate(m.cells[1]!.poly, { a: 6, b: 2 })).toBe(-12)
    const check = numericCheck(m, { a: 6, b: 2 })
    expect(check).toEqual({ product: '(6 - 2)^2 = 4^2 = 16', cells: '36 - 12 - 12 + 4 = 16', area: 16 })
    const conjugate = numericCheck(model(['a', 'b'], ['a', '-b'], { lengths: { a: { value: 5 }, b: { value: 2 } } }), { a: 5, b: 2 })
    expect(conjugate.product).toBe('(5 + 2)(5 - 2) = 7·3 = 21')
    expect(conjugate.cells).toBe('25 - 10 + 10 - 4 = 21')
    for (const chain of [check.product, check.cells, conjugate.product, conjugate.cells]) expect(chainHolds(chain), chain).toBe(true)
  })
})

describe('reveal', () => {
  it('reveals partial areas in any order, then combines like terms', () => {
    const m = model(['x', '3'], ['x', '-5'])
    const start = initialReveal(m)
    expect(start.cells).toEqual([false, false, false, false])
    expect(areaStepCount(m)).toBe(5)
    expect(areaLines(m, start)).toEqual(['(x + 3)(x - 5)'])
    expect(nextAreaStep(m, start)).toEqual({ kind: 'cell', index: 0 })

    const one = applyAreaStep(start, { kind: 'cell', index: 2 })
    expect(one.cells).toEqual([false, false, true, false])
    expect(applyAreaStep(one, { kind: 'cell', index: 2 })).toBe(one)
    expect(applyAreaStep(one, { kind: 'combine' })).toBe(one)
    expect(nextAreaStep(m, one)).toEqual({ kind: 'cell', index: 0 })

    const rest = remainingSteps(m, one)
    expect(rest.map((r) => r.step)).toEqual([
      { kind: 'cell', index: 0 },
      { kind: 'cell', index: 1 },
      { kind: 'cell', index: 3 },
      { kind: 'combine' },
    ])
    expect(areaLines(m, rest[2]!.after)).toEqual(['(x + 3)(x - 5)', 'x² - 5x + 3x - 15'])
    const end = rest[3]!.after
    expect(areaLines(m, end)).toEqual(['(x + 3)(x - 5)', 'x² - 5x + 3x - 15', 'x² - 2x - 15'])
    expect(nextAreaStep(m, end)).toBeNull()
  })

  it('needs no combining step without like terms', () => {
    const m = model(['a', 'b'], ['c', 'd'])
    expect(areaStepCount(m)).toBe(4)
    const end = remainingSteps(m, initialReveal(m)).at(-1)!.after
    expect(areaLines(m, end)).toEqual(['(a + b)(c + d)', 'ac + ad + bc + bd'])
  })

  it('reveals the sides when factoring', () => {
    const m = model(['x', '3'], ['x', '3'], { mode: 'factor' })
    const start = initialReveal(m)
    expect(start.cells.every(Boolean)).toBe(true)
    expect(areaLines(m, start)).toEqual(['x² + 6x + 9', 'x² + 3x + 3x + 9'])
    expect(areaStepCount(m)).toBe(2)
    const top = applyAreaStep(start, { kind: 'side', side: 1 })
    expect(nextAreaStep(m, top)).toEqual({ kind: 'side', side: 0 })
    const both = applyAreaStep(top, { kind: 'side', side: 0 })
    expect(areaLines(m, both)).toEqual(['x² + 6x + 9', 'x² + 3x + 3x + 9', '(x + 3)^2'])
    expect(nextAreaStep(m, both)).toBeNull()
  })

  it('shows everything in explore mode', () => {
    const m = exploreSquare()
    expect(nextAreaStep(m, initialReveal(m))).toBeNull()
    expect(areaLines(m, initialReveal(m))).toEqual(['(a - b)^2', 'a² - ab - ab + b²', 'a² - 2ab + b²'])
  })

  it('describes every step for screen readers', () => {
    const m = model(['x', '3'], ['x', '-5'])
    const start = initialReveal(m)
    const cell = { kind: 'cell', index: 1 } as const
    expect(describeStep(m, cell, applyAreaStep(start, cell))).toBe('x mal (−5) gleich −5x')
    expect(describeStep(m, { kind: 'combine' }, start)).toBe('Zusammengefasst: x² − 2x − 15')

    const f = model(['x', '3'], ['x', '3'], { mode: 'factor' })
    const left = applyAreaStep(initialReveal(f), { kind: 'side', side: 0 })
    expect(describeStep(f, { kind: 'side', side: 0 }, left)).toBe('Linke Seite: x + 3')
    const both = applyAreaStep(left, { kind: 'side', side: 1 })
    expect(describeStep(f, { kind: 'side', side: 1 }, both)).toBe('Obere Seite: x + 3. Produkt: (x + 3)²')
  })
})
