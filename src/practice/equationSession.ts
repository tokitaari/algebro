import {
  checkSolutionSet,
  checkStep,
  equationForm,
  readOperation,
  type Equation,
  type EquationTask,
  type Operation,
  type SolutionSet,
  type TermErrorInfo,
} from '../math'
import { isTaskFinished, type Outcome, type SeriesState } from './session'

/** A line the learner has written down and that passed the check: the operation applied to the line before, and the result. */
export interface EquationLine {
  operation: Operation
  equation: Equation
}

/** What the learner sees after pressing "Zeile prüfen" or "Lösungsmenge prüfen" (or "Lösung anzeigen"). */
export type EquationFeedback =
  /** Not final: the line was accepted and is part of `lines` now. */
  | { kind: 'line-correct' }
  /**
   * Not final: the line does not follow from the stated operation. `left` and
   * `right` tell which sides are fine; `keepsSolutions` is true if the line
   * still has the solutions of the line before (e.g. two steps at once).
   */
  | { kind: 'line-wrong'; operation: Operation; equation: Equation; left: boolean; right: boolean; keepsSolutions: boolean }
  /** Not final: the operation field is not readable. `input` is the text the error positions refer to. */
  | { kind: 'operation-invalid'; error: TermErrorInfo; input: string }
  /** Not final: the operation is readable but not an equivalence transformation (e.g. `| · x`). */
  | { kind: 'operation-not-allowed'; error: TermErrorInfo; input: string }
  /** Not final: the new line is not a readable equation. */
  | { kind: 'equation-invalid'; error: TermErrorInfo; input: string }
  /** Not final: the solution set was entered before the last line is solved. */
  | { kind: 'not-solved' }
  /** Not final: the solution set is not readable. */
  | { kind: 'set-invalid'; error: TermErrorInfo; input: string }
  /** Final: a readable but wrong solution set. */
  | { kind: 'set-wrong'; given: SolutionSet }
  /** Final: the solution set is right. */
  | { kind: 'correct' }
  /** Final: the learner gave up and looked at the solution. */
  | { kind: 'revealed' }

/**
 * One practice series of equation tasks. Only the result counts: a task is
 * correct if the solution set is right and the solution was not revealed. Wrong
 * lines can be corrected as often as needed and never finish a task.
 */
export interface EquationSession extends SeriesState {
  tasks: readonly EquationTask[]
  /** Accepted lines of the current task after the given equation; empty at the start of each task. */
  lines: readonly EquationLine[]
  feedback: EquationFeedback | null
}

export function createEquationSession(tasks: readonly EquationTask[]): EquationSession {
  return { tasks, index: 0, outcomes: [], lines: [], feedback: null }
}

export function currentEquationTask(session: EquationSession): EquationTask | undefined {
  return session.tasks[session.index]
}

/** The line the next line follows from: the last accepted one, or the given equation. */
export function currentEquation(session: EquationSession): Equation | undefined {
  return session.lines.at(-1)?.equation ?? currentEquationTask(session)?.equation
}

/**
 * The solution set may be given once `x` stands alone (`x = c` or `c = x`) or
 * both sides are plain numbers (`2 = 3`); before that the learner has to keep
 * transforming.
 */
export function canGiveSolutionSet(equation: Equation): boolean {
  return equationForm(equation) !== 'open'
}

function finish(session: EquationSession, outcome: Outcome, feedback: EquationFeedback): EquationSession {
  return { ...session, outcomes: [...session.outcomes, outcome], feedback }
}

/**
 * Checks the next line: the operation field is read first, then the new line
 * is checked against the line before and that operation (`checkStep`). Only a
 * correct line is added; everything else just shows feedback and allows
 * another try.
 */
export function submitLine(session: EquationSession, operationInput: string, equationInput: string): EquationSession {
  const previous = currentEquation(session)
  if (!previous || isTaskFinished(session)) return session

  const read = readOperation(operationInput)
  if (!read.ok) {
    const feedback: EquationFeedback =
      read.reason === 'invalid'
        ? { kind: 'operation-invalid', error: read.error, input: operationInput }
        : { kind: 'operation-not-allowed', error: read.error, input: operationInput }
    return { ...session, feedback }
  }

  const result = checkStep(previous, read.operation, equationInput)
  switch (result.kind) {
    case 'correct':
      return {
        ...session,
        lines: [...session.lines, { operation: read.operation, equation: result.equation }],
        feedback: { kind: 'line-correct' },
      }
    case 'wrong':
      return {
        ...session,
        feedback: {
          kind: 'line-wrong',
          operation: read.operation,
          equation: result.equation,
          left: result.left,
          right: result.right,
          keepsSolutions: result.keepsSolutions,
        },
      }
    case 'invalid':
      return { ...session, feedback: { kind: 'equation-invalid', error: result.error, input: equationInput } }
  }
}

/**
 * Checks the solution set. Before the last line is solved this only gives a
 * hint; an unreadable input allows another try; a readable one finishes the task.
 */
export function submitSolutionSet(session: EquationSession, input: string): EquationSession {
  const task = currentEquationTask(session)
  const last = currentEquation(session)
  if (!task || !last || isTaskFinished(session)) return session
  if (!canGiveSolutionSet(last)) return { ...session, feedback: { kind: 'not-solved' } }

  const result = checkSolutionSet(task, input)
  switch (result.kind) {
    case 'correct':
      return finish(session, 'correct', { kind: 'correct' })
    case 'wrong':
      return finish(session, 'wrong', { kind: 'set-wrong', given: result.given })
    case 'invalid':
      return { ...session, feedback: { kind: 'set-invalid', error: result.error, input } }
  }
}

/** The learner gives up: the task counts as wrong and the model solution is shown. */
export function revealEquationSolution(session: EquationSession): EquationSession {
  if (!currentEquationTask(session) || isTaskFinished(session)) return session
  return finish(session, 'wrong', { kind: 'revealed' })
}

/** Moves on after a finished task; after the last one the series is over. */
export function nextEquationTask(session: EquationSession): EquationSession {
  if (!isTaskFinished(session)) return session
  return { ...session, index: session.index + 1, lines: [], feedback: null }
}
