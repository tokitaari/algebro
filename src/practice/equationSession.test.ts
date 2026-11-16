import { describe, expect, it } from 'vitest'
import {
  buildEquationTask,
  equationToText,
  operationToText,
  parse,
  readEquation,
  solutionSetToText,
  type EquationTask,
} from '../math'
import {
  canGiveSolutionSet,
  createEquationSession,
  currentEquation,
  currentEquationTask,
  nextEquationTask,
  revealEquationSolution,
  submitLine,
  submitSolutionSet,
  type EquationSession,
} from './equationSession'
import { countCorrect, finishedBetween, isSeriesOver, isTaskFinished } from './session'

const TOPIC = 'algebra/lineare-gleichungen/umformen'

/** 3x + 2 = x + 8, solution x = 3. */
const unique = () => buildEquationTask(TOPIC, parse('3x + 2'), parse('x + 8'))
/** x + 2 = x + 3, no solution. */
const empty = () => buildEquationTask('algebra/lineare-gleichungen/sonderfaelle', parse('x + 2'), parse('x + 3'))
/** 2(x + 1) = 2x + 2, every number is a solution. */
const all = () => buildEquationTask('algebra/lineare-gleichungen/sonderfaelle', parse('2(x + 1)'), parse('2x + 2'))

const start = (...tasks: EquationTask[]) => createEquationSession(tasks)

describe('equation session', () => {
  it('starts with the given equation as the only line', () => {
    const session = start(unique(), empty())
    expect(session.index).toBe(0)
    expect(session.lines).toEqual([])
    expect(equationToText(currentEquation(session)!)).toBe('3x + 2 = x + 8')
    expect(isTaskFinished(session)).toBe(false)
    expect(isSeriesOver(session)).toBe(false)
  })

  it('accepts a correct line and builds on it', () => {
    let session = start(unique())
    session = submitLine(session, '| - x', '2x + 2 = 8')
    expect(session.feedback).toEqual({ kind: 'line-correct' })
    expect(session.lines).toHaveLength(1)
    expect(operationToText(session.lines[0]!.operation)).toBe('| - x')
    expect(equationToText(currentEquation(session)!)).toBe('2x + 2 = 8')
    // The next line is checked against the accepted one.
    session = submitLine(session, '| - 2', '2x = 6')
    expect(session.lines).toHaveLength(2)
    expect(isTaskFinished(session)).toBe(false)
  })

  it('does not care how far a side is simplified, and takes "Term umformen" and "⇄"', () => {
    let session = start(unique())
    session = submitLine(session, '| - x', '3x + 2 - x = x + 8 - x')
    expect(session.feedback).toEqual({ kind: 'line-correct' })
    session = submitLine(session, '| Term umformen', '2x + 2 = 8')
    expect(session.feedback).toEqual({ kind: 'line-correct' })
    session = submitLine(session, '| ⇄', '8 = 2x + 2')
    expect(session.feedback).toEqual({ kind: 'line-correct' })
    expect(session.lines).toHaveLength(3)
  })

  it('reports which side is wrong and keeps the line out of the solution', () => {
    const session = submitLine(start(unique()), '| - x', '2x + 2 = 9')
    expect(session.lines).toHaveLength(0)
    expect(session.outcomes).toHaveLength(0)
    expect(session.feedback).toMatchObject({ kind: 'line-wrong', left: true, right: false, keepsSolutions: false })
  })

  it('notices two steps at once: right solutions, wrong operation', () => {
    const session = submitLine(start(unique()), '| - x', '2x = 6')
    expect(session.feedback).toMatchObject({ kind: 'line-wrong', left: false, right: false, keepsSolutions: true })
    expect(session.lines).toHaveLength(0)
  })

  it('rejects operations that are not equivalence transformations, without ending the task', () => {
    const session = submitLine(start(unique()), '| · x', '3x² + 2x = x² + 8x')
    expect(session.feedback).toMatchObject({ kind: 'operation-not-allowed', input: '| · x' })
    expect(session.feedback).toHaveProperty('error.code', 'multiply-by-term')
    expect(isTaskFinished(session)).toBe(false)
    expect(session.lines).toHaveLength(0)
  })

  it('tells an unreadable operation from an unreadable line', () => {
    const operation = submitLine(start(unique()), '3', '2x + 2 = 8')
    expect(operation.feedback).toMatchObject({ kind: 'operation-invalid', input: '3' })
    const blank = submitLine(start(unique()), '', '2x + 2 = 8')
    expect(blank.feedback).toMatchObject({ kind: 'operation-invalid' })
    const line = submitLine(start(unique()), '| - x', '2x + 2 =')
    expect(line.feedback).toMatchObject({ kind: 'equation-invalid', input: '2x + 2 =' })
    expect(line.lines).toHaveLength(0)
  })

  it('does nothing once the task is finished', () => {
    const finished = revealEquationSolution(start(unique()))
    expect(submitLine(finished, '| - x', '2x + 2 = 8')).toBe(finished)
    expect(submitSolutionSet(finished, 'L = {3}')).toBe(finished)
    expect(revealEquationSolution(finished)).toBe(finished)
  })
})

describe('solution set', () => {
  const solved = (session: EquationSession, ...lines: [operation: string, equation: string][]) =>
    lines.reduce((s, [operation, equation]) => submitLine(s, operation, equation), session)

  it('may only be given once x stands alone or only numbers are left', () => {
    expect(canGiveSolutionSet(currentEquation(start(unique()))!)).toBe(false)
    const early = submitSolutionSet(start(unique()), 'L = {3}')
    expect(early.feedback).toEqual({ kind: 'not-solved' })
    expect(early.outcomes).toHaveLength(0)

    const almost = solved(start(unique()), ['| - x', '2x + 2 = 8'], ['| - 2', '2x = 6'])
    expect(submitSolutionSet(almost, 'L = {3}').feedback).toEqual({ kind: 'not-solved' })
  })

  it('accepts x = c as well as c = x', () => {
    const steps: [string, string][] = [
      ['| - x', '2x + 2 = 8'],
      ['| - 2', '2x = 6'],
      ['| : 2', 'x = 3'],
    ]
    const direct = solved(start(unique()), ...steps)
    expect(submitSolutionSet(direct, 'L = {3}').feedback).toEqual({ kind: 'correct' })

    // Swapping back is not required: c = x is enough.
    const swapped = solved(start(unique()), ...steps, ['| ⇄', '3 = x'])
    expect(swapped.lines).toHaveLength(4)
    expect(submitSolutionSet(swapped, 'L = {3}').feedback).toEqual({ kind: 'correct' })
  })

  it.each([
    ['x = 3', true],
    ['3 = x', true],
    ['-3 = x', true],
    ['2 = 3', true],
    ['5 = 5', true],
    ['2x = 6', false],
    ['x = 6 : 2', false],
    ['x + 1 = 4', false],
    ['x = x', false],
  ])('judges "%s" as ready for the solution set: %s', (text, ready) => {
    const read = readEquation(text)
    if (!read.ok) throw new Error(`not readable: ${text}`)
    expect(canGiveSolutionSet(read.equation)).toBe(ready)
  })

  it('counts a right solution set as correct and a wrong one as wrong', () => {
    const lines: [string, string][] = [
      ['| - x', '2x + 2 = 8'],
      ['| - 2', '2x = 6'],
      ['| : 2', 'x = 3'],
    ]
    const right = submitSolutionSet(solved(start(unique()), ...lines), 'L = {3}')
    expect(right.outcomes).toEqual(['correct'])
    expect(isTaskFinished(right)).toBe(true)

    const wrong = submitSolutionSet(solved(start(unique()), ...lines), 'L = {4}')
    expect(wrong.outcomes).toEqual(['wrong'])
    expect(wrong.feedback).toMatchObject({ kind: 'set-wrong', given: { kind: 'single' } })
  })

  it('ignores earlier wrong lines: only the result counts', () => {
    let session = start(unique())
    session = submitLine(session, '| - x', '2x + 2 = 9')
    session = submitLine(session, '| · x', '3x² + 2x = x² + 8x')
    session = submitLine(session, '', '')
    session = solved(session, ['| - x', '2x + 2 = 8'], ['| - 2', '2x = 6'], ['| : 2', 'x = 3'])
    expect(submitSolutionSet(session, 'L = {3}').outcomes).toEqual(['correct'])
  })

  it('asks again for an unreadable solution set', () => {
    const session = solved(start(unique()), ['| - x', '2x + 2 = 8'], ['| - 2', '2x = 6'], ['| : 2', 'x = 3'])
    const result = submitSolutionSet(session, 'L = 3')
    expect(result.feedback).toMatchObject({ kind: 'set-invalid', input: 'L = 3' })
    expect(result.outcomes).toHaveLength(0)
  })

  it('knows the empty set: 2 = 3', () => {
    const session = solved(start(empty()), ['| - x', '2 = 3'])
    expect(canGiveSolutionSet(currentEquation(session)!)).toBe(true)
    expect(submitSolutionSet(session, 'L = { }').feedback).toEqual({ kind: 'correct' })
    expect(submitSolutionSet(session, 'L = ℚ').outcomes).toEqual(['wrong'])
  })

  it('knows that every number is a solution: 2 = 2', () => {
    const session = solved(start(all()), ['| Term umformen', '2x + 2 = 2x + 2'], ['| - 2x', '2 = 2'])
    expect(canGiveSolutionSet(currentEquation(session)!)).toBe(true)
    expect(submitSolutionSet(session, 'L = ℚ').feedback).toEqual({ kind: 'correct' })
    expect(submitSolutionSet(session, 'L = { }').outcomes).toEqual(['wrong'])
  })

  it('takes the text form of every solution set', () => {
    for (const task of [unique(), empty(), all()]) {
      const lines = task.steps.map((step): [string, string] => [operationToText(step.operation), equationToText(step.equation)])
      const session = solved(start(task), ...lines)
      expect(submitSolutionSet(session, solutionSetToText(task.solutionSet)).outcomes, task.key).toEqual(['correct'])
    }
  })
})

describe('series', () => {
  it('counts a revealed solution as wrong and moves on with a clean slate', () => {
    let session = start(unique(), empty())
    session = submitLine(session, '| - x', '2x + 2 = 8')
    const revealed = revealEquationSolution(session)
    expect(revealed.outcomes).toEqual(['wrong'])
    expect(revealed.feedback).toEqual({ kind: 'revealed' })
    expect(finishedBetween(session, revealed)).toEqual({ correct: false })

    const next = nextEquationTask(revealed)
    expect(next.index).toBe(1)
    expect(next.lines).toEqual([])
    expect(next.feedback).toBeNull()
    expect(currentEquationTask(next)?.key).toBe('x + 2 = x + 3')
    expect(nextEquationTask(session)).toBe(session)
  })

  it('reports the series result with the last task', () => {
    let session = start(unique())
    const before = session
    session = revealEquationSolution(session)
    expect(finishedBetween(before, session)).toEqual({ correct: false, series: { correct: 0, total: 1 } })
    session = nextEquationTask(session)
    expect(isSeriesOver(session)).toBe(true)
    expect(countCorrect(session)).toBe(0)
    expect(currentEquationTask(session)).toBeUndefined()
    expect(currentEquation(session)).toBeUndefined()
  })
})
