// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  applyMove,
  BALANCE_GEOMETRY,
  balanceLines,
  balancePose,
  balanceProblems,
  balanceResult,
  balanceTerms,
  balanceTilt,
  buildBalance,
  currentPans,
  describeBalance,
  describePan,
  INITIAL_BALANCE_STATE,
  isPieceLeaving,
  layoutPan,
  lineText,
  nowText,
  pushEntry,
  remainingBalanceSteps,
  undoEntry,
  type BalanceModel,
  type BalanceOperation,
  type BalanceState,
  type MoveResult,
  type Pan,
  type Pans,
} from './balance'
import type { BalanceWidget } from './types'

const steps: BalanceWidget = { kind: 'balance', equation: '3x + 2 = x + 8', mode: 'steps', steps: ['| - x', '| - 2', '| : 2'] }
const explore: BalanceWidget = { kind: 'balance', equation: '3x + 2 = x + 8', mode: 'explore', operations: ['| - 2', '| : 2', '| + x'] }

const pan = (boxes: number, boxBalloons: number, units: number, unitBalloons: number): Pan => ({ boxes, boxBalloons, units, unitBalloons })

function operation(model: BalanceModel, text: string): BalanceOperation {
  const found = [...model.steps, ...model.palette].find((op) => op.text === text)
  if (!found) throw new Error(`No operation ${text}`)
  return found
}

function moved(result: MoveResult): Extract<MoveResult, { ok: true }> {
  if (!result.ok) throw new Error(`Move failed: ${result.code}`)
  return result
}

describe('buildBalance', () => {
  it('reads the pans, the variable, the solution and the steps', () => {
    const model = buildBalance(steps)
    expect(model.variable).toBe('x')
    expect(model.start).toEqual([pan(3, 0, 2, 0), pan(1, 0, 8, 0)])
    expect(model.boxWeight).toBe(3)
    expect(model.steps.map((s) => s.text)).toEqual(['- x', '- 2', ': 2'])
    expect(model.steps.map((s) => s.move)).toEqual([
      { kind: 'add', boxes: -1, units: 0 },
      { kind: 'add', boxes: 0, units: -2 },
      { kind: 'divide', by: 2 },
    ])
    expect(model.palette).toEqual([])
  })

  it('turns negative terms into balloons', () => {
    const model = buildBalance({ kind: 'balance', equation: '2x - 3 = x + 1', mode: 'steps', steps: ['| + 3', '| - x'] })
    expect(model.start).toEqual([pan(2, 0, 0, 3), pan(1, 0, 1, 0)])
    expect(model.boxWeight).toBe(4)
    expect(balanceTilt(model, model.start)).toBe('balanced')
  })

  it('offers a default palette in explore mode', () => {
    const model = buildBalance({ kind: 'balance', equation: '2a + 1 = 7', mode: 'explore' })
    expect(model.palette.map((op) => op.text)).toEqual(['+ 1', '- 1', '+ a', '- a', ': 2', ': 3'])
    expect(model.steps).toEqual([])
  })

  it('reads times and divided by −1 as a flip', () => {
    const model = buildBalance({ kind: 'balance', equation: '-x = -3', mode: 'explore', operations: ['| · (-1)', '| : (-1)'] })
    expect(model.palette.map((op) => op.move)).toEqual([{ kind: 'flip' }, { kind: 'flip' }])
    expect(model.palette.map((op) => op.text)).toEqual(['· (-1)', ': (-1)'])
  })

  it('throws for a widget with problems', () => {
    expect(() => buildBalance({ kind: 'balance', equation: 'x', mode: 'explore' })).toThrow('Invalid balance')
  })
})

describe('balanceProblems', () => {
  const problemsOf = (widget: Omit<BalanceWidget, 'kind'>) => balanceProblems({ kind: 'balance', ...widget })

  it('accepts valid widgets', () => {
    expect(balanceProblems(steps)).toEqual([])
    expect(balanceProblems(explore)).toEqual([])
    expect(problemsOf({ equation: 'x + 2 = x + 3', mode: 'explore' })).toEqual([])
    expect(problemsOf({ equation: '2x + 2 = 2(x + 1)', mode: 'explore' })).toEqual([])
  })

  it('needs a linear equation in one variable that fits on the pans', () => {
    expect(problemsOf({ equation: 'x +', mode: 'explore' })).toEqual(['balance: equation "x +" does not parse'])
    expect(problemsOf({ equation: '2x + y = 4', mode: 'explore' })).toEqual(['balance: the equation needs exactly one variable'])
    expect(problemsOf({ equation: '3 = 3', mode: 'explore' })).toEqual(['balance: the equation needs exactly one variable'])
    expect(problemsOf({ equation: 'x^2 = 4', mode: 'explore' })).toEqual(['balance: both sides must be linear with whole numbers'])
    expect(problemsOf({ equation: '7x = 7', mode: 'explore' })).toEqual([
      'balance: the equation needs at most 6 x pieces and 12 unit pieces per side',
    ])
  })

  it('needs a whole solution that is not negative', () => {
    expect(problemsOf({ equation: 'x + 5 = 2', mode: 'explore' })).toEqual([
      'balance: the solution -3 must be a whole number that is not negative',
    ])
    expect(problemsOf({ equation: '2x = 3', mode: 'explore' })).toEqual([
      'balance: the solution 3/2 must be a whole number that is not negative',
    ])
    expect(problemsOf({ equation: '2x = 0', mode: 'explore' })).toEqual([])
  })

  it('checks the operations', () => {
    expect(
      problemsOf({ equation: '2x = 6', mode: 'explore', operations: ['| · 2', '| - y', '⇄', '| · x', '| : 7', '| + 0', '| : 2'] }),
    ).toEqual([
      'balance: operation "| · 2" is not supported: use ": 2" to ": 6" or "· (-1)"',
      'balance: operation "| - y" needs whole numbers and whole multiples of x',
      'balance: operation "⇄" has no picture on the balance',
      'balance: operation "| · x" cannot be used (multiply-by-term)',
      'balance: operation "| : 7" is not supported: use ": 2" to ": 6" or "· (-1)"',
      'balance: operation "| + 0" changes nothing',
    ])
  })

  it('checks the mode-specific fields', () => {
    expect(problemsOf({ equation: '2x = 6', mode: 'steps' })).toEqual(['balance: steps mode needs steps'])
    expect(problemsOf({ equation: '2x = 6', mode: 'steps', steps: ['| : 2'], operations: ['| : 2'] })).toEqual([
      'balance: operations are only used in explore mode',
    ])
    expect(problemsOf({ equation: '2x = 6', mode: 'explore', steps: ['| : 2'] })).toEqual(['balance: steps are only used in steps mode'])
    expect(problemsOf({ equation: '2x = 6', mode: 'explore', operations: [] })).toEqual(['balance: explore mode needs operations'])
    expect(problemsOf({ equation: '2x = 6', mode: 'explore', operations: Array.from({ length: 9 }, () => '| + 1') })).toEqual([
      'balance: explore mode has at most 8 operations',
    ])
  })

  it('simulates the steps', () => {
    expect(problemsOf({ equation: '3x + 2 = x + 8', mode: 'steps', steps: ['| - x', '| : 3', '| - 2'] })).toEqual([
      'balance: step ": 3" does not work on 2x + 2 = 8 (not-divisible)',
    ])
    expect(problemsOf({ equation: 'x + 12 = x + 12', mode: 'steps', steps: ['| + 1'] })).toEqual([
      'balance: step "+ 1" does not work on x + 12 = x + 12 (no-room)',
    ])
  })
})

describe('applyMove', () => {
  const model = buildBalance(steps)
  const free = buildBalance(explore)

  it('adds balloons on both sides, cancels pairs and keeps the balance level', () => {
    const result = moved(applyMove(model, model.start, operation(model, '- x'), 'both'))
    expect(result.pans).toEqual([pan(2, 0, 2, 0), pan(0, 0, 8, 0)])
    expect(result.frames).toEqual([
      { pans: [pan(3, 1, 2, 0), pan(1, 1, 8, 0)], text: 'Auf beiden Seiten minus x: je 1 x-Ballon kommt dazu.' },
      {
        pans: [pan(3, 1, 2, 0), pan(1, 1, 8, 0)],
        cancelling: [
          { boxes: 1, units: 0 },
          { boxes: 1, units: 0 },
        ],
        text: 'Links heben sich 1 x-Kästchen und 1 x-Ballon auf. Rechts heben sich 1 x-Kästchen und 1 x-Ballon auf.',
      },
      { pans: [pan(2, 0, 2, 0), pan(0, 0, 8, 0)], text: 'Die Waage bleibt im Gleichgewicht. Jetzt: 2x + 2 = 8.' },
    ])
    expect(result.summary).toBe(result.frames.map((f) => f.text).join(' '))
    // Every picture on the way is level, too.
    expect(result.frames.map((f) => balanceTilt(model, f.pans))).toEqual(['balanced', 'balanced', 'balanced'])
  })

  it('needs a single picture if nothing cancels', () => {
    const result = moved(applyMove(free, free.start, operation(free, '+ x'), 'both'))
    expect(result.pans).toEqual([pan(4, 0, 2, 0), pan(2, 0, 8, 0)])
    expect(result.frames).toEqual([
      {
        pans: result.pans,
        text: 'Auf beiden Seiten plus x: je 1 x-Kästchen kommt dazu. Die Waage bleibt im Gleichgewicht. Jetzt: 4x + 2 = 2x + 8.',
      },
    ])
  })

  it('tips the balance if only one side is transformed, and levels it again', () => {
    const left = moved(applyMove(free, free.start, operation(free, '- 2'), 'left'))
    expect(left.pans).toEqual([pan(3, 0, 0, 0), pan(1, 0, 8, 0)])
    expect(left.frames.map((f) => f.text)).toEqual([
      'Nur links minus 2: 2 Ballons kommen dazu.',
      'Links heben sich 2 Gewichte und 2 Ballons auf.',
      'Die Waage kippt: Die rechte Seite ist jetzt schwerer. Jetzt: 3x ≠ x + 8.',
    ])
    expect(balanceTilt(free, left.pans)).toBe('right')

    const again = moved(applyMove(free, left.pans, operation(free, '- 2'), 'left'))
    expect(again.pans).toEqual([pan(3, 0, 0, 2), pan(1, 0, 8, 0)])
    expect(again.frames.map((f) => f.text)).toEqual([
      'Nur links minus 2: 2 Ballons kommen dazu. Die rechte Seite bleibt schwerer. Jetzt: 3x − 2 ≠ x + 8.',
    ])

    const right = moved(applyMove(free, left.pans, operation(free, '- 2'), 'right'))
    expect(right.pans).toEqual([pan(3, 0, 0, 0), pan(1, 0, 6, 0)])
    expect(right.frames.at(-1)?.text).toBe('Die Waage ist wieder im Gleichgewicht. Jetzt: 3x = x + 6.')
  })

  it('divides into equal groups and keeps one', () => {
    const pans: Pans = [pan(2, 0, 0, 0), pan(0, 0, 6, 0)]
    const result = moved(applyMove(model, pans, operation(model, ': 2'), 'both'))
    expect(result.pans).toEqual([pan(1, 0, 0, 0), pan(0, 0, 3, 0)])
    expect(result.frames).toEqual([
      { pans, groups: [2, 2], text: 'Auf beiden Seiten geteilt durch 2: 2 gleiche Gruppen.' },
      { pans, groups: [2, 2], leaving: true, text: 'Eine Gruppe bleibt, die anderen kommen weg.' },
      { pans: result.pans, text: 'Die Waage bleibt im Gleichgewicht. Jetzt: x = 3. Das x-Kästchen liegt allein.' },
    ])
    expect(balanceResult(model, result.pans)).toBe(3)

    const oneSide = moved(applyMove(model, pans, operation(model, ': 2'), 'right'))
    expect(oneSide.pans).toEqual([pan(2, 0, 0, 0), pan(0, 0, 3, 0)])
    expect(oneSide.frames[0]?.groups).toEqual([1, 2])
    expect(balanceTilt(model, oneSide.pans)).toBe('left')
  })

  it('refuses a division that leaves pieces over', () => {
    expect(applyMove(model, model.start, operation(model, ': 2'), 'both')).toEqual({
      ok: false,
      code: 'not-divisible',
      message: 'Durch 2 lässt sich hier nicht teilen: Die Stücke gehen nicht in 2 gleiche Gruppen auf.',
    })
    // Only the right pan (x + 8) is asked: one box cannot be split either.
    expect(applyMove(model, model.start, operation(model, ': 2'), 'right').ok).toBe(false)
  })

  it('refuses pieces that do not fit on a pan', () => {
    const full = buildBalance({ kind: 'balance', equation: 'x + 12 = x + 12', mode: 'explore' })
    expect(applyMove(full, full.start, operation(full, '+ 1'), 'both')).toEqual({
      ok: false,
      code: 'no-room',
      message: 'Dafür ist auf der Waage kein Platz mehr.',
    })
    expect(applyMove(full, full.start, operation(full, '- 1'), 'both').ok).toBe(true)
  })

  it('swaps weights and balloons when multiplying by −1', () => {
    const negative = buildBalance({ kind: 'balance', equation: '-x = -3', mode: 'steps', steps: ['| · (-1)'] })
    expect(negative.start).toEqual([pan(0, 1, 0, 0), pan(0, 0, 0, 3)])
    expect(balanceTilt(negative, negative.start)).toBe('balanced')
    const result = moved(applyMove(negative, negative.start, operation(negative, '· (-1)'), 'both'))
    expect(result.pans).toEqual([pan(1, 0, 0, 0), pan(0, 0, 3, 0)])
    expect(result.frames.map((f) => f.text)).toEqual([
      'Auf beiden Seiten mal (−1): Gewichte und Ballons tauschen die Rollen. Die Waage bleibt im Gleichgewicht. Jetzt: x = 3. Das x-Kästchen liegt allein.',
    ])
  })
})

describe('equations without or with infinitely many solutions', () => {
  it('never is level without a solution', () => {
    const model = buildBalance({ kind: 'balance', equation: 'x + 2 = x + 3', mode: 'steps', steps: ['| - x', '| - 2'] })
    expect(balanceTilt(model, model.start)).toBe('right')
    const plan = remainingBalanceSteps(model, INITIAL_BALANCE_STATE)
    expect(plan.map((step) => balanceTilt(model, step.entry.pans))).toEqual(['right', 'right'])
    expect(plan.at(-1)?.frames.at(-1)?.text).toBe('Die rechte Seite bleibt schwerer. Jetzt: 0 ≠ 1.')
    expect(balanceResult(model, plan.at(-1)?.entry.pans ?? model.start)).toBeNull()
  })

  it('always is level with infinitely many solutions', () => {
    const model = buildBalance({ kind: 'balance', equation: '2x + 2 = 2(x + 1)', mode: 'steps', steps: ['| - 2', '| : 2', '| - x'] })
    const plan = remainingBalanceSteps(model, INITIAL_BALANCE_STATE)
    expect(plan.map((step) => balanceTilt(model, step.entry.pans))).toEqual(['balanced', 'balanced', 'balanced'])
    expect(nowText(model, plan.at(-1)?.entry.pans ?? model.start)).toBe('Jetzt: 0 = 0.')
  })
})

describe('state and lines', () => {
  const model = buildBalance(steps)

  it('plans the remaining steps and records them', () => {
    const plan = remainingBalanceSteps(model, INITIAL_BALANCE_STATE)
    expect(plan.map((step) => step.entry.operation.text)).toEqual(['- x', '- 2', ': 2'])
    expect(plan.map((step) => step.entry.target)).toEqual(['both', 'both', 'both'])
    const [first, second] = plan
    if (!first || !second) throw new Error('plan too short')

    let state: BalanceState = pushEntry(INITIAL_BALANCE_STATE, first.entry)
    expect(currentPans(model, INITIAL_BALANCE_STATE)).toBe(model.start)
    expect(currentPans(model, state)).toEqual([pan(2, 0, 2, 0), pan(0, 0, 8, 0)])
    expect(remainingBalanceSteps(model, state).map((step) => step.entry.operation.text)).toEqual(['- 2', ': 2'])

    state = pushEntry(state, second.entry)
    expect(balanceLines(model, state).map(lineText)).toEqual(['3x + 2 = x + 8', '2x + 2 = 8', '2x = 6'])
    expect(balanceLines(model, state).map((line) => line.operation?.text)).toEqual(['- x', '- 2', undefined])
    expect(undoEntry(state)).toEqual({ entries: [first.entry] })
    expect(undoEntry(INITIAL_BALANCE_STATE)).toEqual(INITIAL_BALANCE_STATE)
  })

  it('gives the lines as terms', () => {
    expect(balanceLines(model, INITIAL_BALANCE_STATE)).toEqual([{ left: '3x + 2', right: 'x + 8', balanced: true }])
    expect(balanceTerms(model)).toEqual(['3x + 2', 'x + 8', '2x + 2', '8', '2x', '6', 'x', '3'])
    expect(balanceTerms(buildBalance(explore))).toEqual(['3x + 2', 'x + 8'])
  })

  it('reads off x only when a box lies alone on a level balance', () => {
    expect(balanceResult(model, model.start)).toBeNull()
    expect(balanceResult(model, [pan(1, 0, 0, 0), pan(0, 0, 3, 0)])).toBe(3)
    expect(balanceResult(model, [pan(0, 0, 3, 0), pan(1, 0, 0, 0)])).toBe(3)
    // Not level: the box weighs 3.
    expect(balanceResult(model, [pan(1, 0, 0, 0), pan(0, 0, 4, 0)])).toBeNull()
    expect(balanceResult(model, [pan(2, 0, 0, 0), pan(0, 0, 6, 0)])).toBeNull()
  })
})

describe('texts', () => {
  it('describes pans and the whole balance', () => {
    expect(describePan(pan(0, 0, 0, 0), 'x')).toBe('nichts')
    expect(describePan(pan(1, 0, 1, 0), 'x')).toBe('1 x-Kästchen und 1 Gewicht')
    expect(describePan(pan(3, 1, 2, 4), 'a')).toBe('3 a-Kästchen, 1 a-Ballon, 2 Gewichte und 4 Ballons')
    expect(describePan(pan(0, 2, 0, 1), 'x')).toBe('2 x-Ballons und 1 Ballon')
    const model = buildBalance(steps)
    expect(describeBalance(model, model.start)).toBe(
      'Waage. Links: 3 x-Kästchen und 2 Gewichte. Rechts: 1 x-Kästchen und 8 Gewichte. Die Waage ist im Gleichgewicht.',
    )
    expect(describeBalance(model, [pan(3, 0, 0, 0), pan(1, 0, 8, 0)])).toBe(
      'Waage. Links: 3 x-Kästchen. Rechts: 1 x-Kästchen und 8 Gewichte. Die rechte Seite ist schwerer.',
    )
  })
})

describe('geometry', () => {
  it('turns the beam towards the heavier side', () => {
    const { pivot, arm } = BALANCE_GEOMETRY
    expect(balancePose('balanced')).toEqual({
      angle: 0,
      ends: [
        { x: pivot.x - arm, y: pivot.y },
        { x: pivot.x + arm, y: pivot.y },
      ],
    })
    const right = balancePose('right')
    expect(right.angle).toBeGreaterThan(0)
    expect(right.ends[1].y).toBeGreaterThan(pivot.y)
    expect(right.ends[0].y).toBeLessThan(pivot.y)
    const left = balancePose('left')
    expect(left.angle).toBe(-right.angle)
    expect(left.ends[0].y).toBeCloseTo(right.ends[1].y)
  })

  it('stands the weights on the plate in rows', () => {
    const layout = layoutPan(pan(3, 0, 2, 0))
    expect(layout.columns).toEqual([{ x: -78, width: 156, height: 44 }])
    expect(layout.pieces).toEqual([
      { kind: 'box', index: 0, x: -25, y: -11, column: 0 },
      { kind: 'box', index: 1, x: 0, y: -11, column: 0 },
      { kind: 'box', index: 2, x: 25, y: -11, column: 0 },
      { kind: 'unit', index: 0, x: -9.5, y: -33, column: 0 },
      { kind: 'unit', index: 1, x: 9.5, y: -33, column: 0 },
    ])
  })

  it('wraps long rows', () => {
    const layout = layoutPan(pan(0, 0, 12, 0))
    expect(layout.pieces.filter((p) => p.y === -8)).toHaveLength(8)
    expect(layout.pieces.filter((p) => p.y === -27)).toHaveLength(4)
    expect(layout.columns[0]?.height).toBe(38)
  })

  it('lets the balloons float above the plate and the weights', () => {
    const layout = layoutPan(pan(0, 1, 0, 3))
    expect(layout.pieces).toEqual([
      { kind: 'box-balloon', index: 0, x: 0, y: -41, column: 0 },
      { kind: 'unit-balloon', index: 0, x: -19, y: -67, column: 0 },
      { kind: 'unit-balloon', index: 1, x: 0, y: -67, column: 0 },
      { kind: 'unit-balloon', index: 2, x: 19, y: -67, column: 0 },
    ])
    const mixed = layoutPan(pan(2, 0, 0, 1))
    // 25 for the row of boxes, 12 clearance, then the balloon with a half axis of 10.
    expect(mixed.pieces.at(-1)).toEqual({ kind: 'unit-balloon', index: 0, x: 0, y: -47, column: 0 })
  })

  it('splits a pan into equal groups', () => {
    const layout = layoutPan(pan(2, 0, 6, 0), 2)
    expect(layout.columns).toEqual([
      { x: -78, width: 78, height: 44 },
      { x: 0, width: 78, height: 44 },
    ])
    expect(layout.pieces).toEqual([
      { kind: 'box', index: 0, x: -39, y: -11, column: 0 },
      { kind: 'unit', index: 0, x: -58, y: -33, column: 0 },
      { kind: 'unit', index: 1, x: -39, y: -33, column: 0 },
      { kind: 'unit', index: 2, x: -20, y: -33, column: 0 },
      { kind: 'box', index: 1, x: 39, y: -11, column: 1 },
      { kind: 'unit', index: 3, x: 20, y: -33, column: 1 },
      { kind: 'unit', index: 4, x: 39, y: -33, column: 1 },
      { kind: 'unit', index: 5, x: 58, y: -33, column: 1 },
    ])
    // Not divisible: drawn as one group.
    expect(layoutPan(pan(3, 0, 6, 0), 2).columns).toHaveLength(1)
  })

  it('marks cancelling pairs and groups that go', () => {
    const mixed = pan(3, 1, 2, 2)
    const pieces = layoutPan(mixed).pieces
    const pairs = { boxes: 1, units: 2 }
    const leaving = pieces.filter((piece) => isPieceLeaving(piece, mixed, {}, pairs)).map((piece) => `${piece.kind}-${piece.index}`)
    expect(leaving).toEqual(['box-2', 'unit-0', 'unit-1', 'box-balloon-0', 'unit-balloon-0', 'unit-balloon-1'])
    expect(pieces.some((piece) => isPieceLeaving(piece, mixed, {}, undefined))).toBe(false)

    const grouped = pan(2, 0, 6, 0)
    const going = layoutPan(grouped, 2).pieces.filter((piece) => isPieceLeaving(piece, grouped, { leaving: true }, undefined))
    expect(going.map((piece) => `${piece.kind}-${piece.index}`)).toEqual(['box-1', 'unit-3', 'unit-4', 'unit-5'])
  })
})
