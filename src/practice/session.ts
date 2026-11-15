import { checkAnswer, readTerm, type Expr, type FormHint, type Task, type TermErrorInfo } from '../math'
import type { SeriesResult } from './progress'

export type Outcome = 'correct' | 'wrong'

/** What the learner sees after pressing "Prüfen" (or "Lösung anzeigen"). */
export type Feedback =
  /** Final: equivalent and in the requested form. */
  | { kind: 'correct' }
  /** Final: not equivalent. `answer` is the parsed input, shown next to the model solution. */
  | { kind: 'wrong'; answer: Expr | null }
  /** Final: the learner gave up and looked at the solution. */
  | { kind: 'revealed' }
  /** Not final: equivalent but not in the requested form; the learner may try again. */
  | { kind: 'wrong-form'; hint: FormHint }
  /** Not final: the input is not a readable term. `input` is the text the error positions refer to. */
  | { kind: 'invalid'; error: TermErrorInfo; input: string }

/**
 * One practice series. `outcomes[i]` is the result of `tasks[i]`; the current
 * task is finished as soon as `outcomes.length > index`. `index === tasks.length`
 * means the series is over and the summary is shown.
 */
export interface Session {
  tasks: readonly Task[]
  index: number
  outcomes: readonly Outcome[]
  feedback: Feedback | null
}

/** Reported once per finished task so the UI can store the progress. */
export interface FinishedTask {
  correct: boolean
  /** Set when this task completed the series. */
  series?: SeriesResult
}

export function createSession(tasks: readonly Task[]): Session {
  return { tasks, index: 0, outcomes: [], feedback: null }
}

export function currentTask(session: Session): Task | undefined {
  return session.tasks[session.index]
}

export function isTaskFinished(session: Session): boolean {
  return session.index < session.tasks.length && session.outcomes.length > session.index
}

export function isSeriesOver(session: Session): boolean {
  return session.index >= session.tasks.length
}

export function countCorrect(session: Session): number {
  return session.outcomes.filter((o) => o === 'correct').length
}

function finish(session: Session, outcome: Outcome, feedback: Feedback): Session {
  return { ...session, outcomes: [...session.outcomes, outcome], feedback }
}

/**
 * Checks an answer with `checkAnswer`. Only "correct" and "wrong" finish the
 * task; a wrong form or unreadable input just shows a hint and allows another try.
 */
export function submitAnswer(session: Session, input: string): Session {
  const task = currentTask(session)
  if (!task || isTaskFinished(session)) return session
  const result = checkAnswer(task, input)
  switch (result.kind) {
    case 'correct':
      return finish(session, 'correct', { kind: 'correct' })
    case 'wrong': {
      const read = readTerm(input)
      return finish(session, 'wrong', { kind: 'wrong', answer: read.ok ? read.expr : null })
    }
    case 'wrong-form':
      return { ...session, feedback: { kind: 'wrong-form', hint: result.hint } }
    case 'invalid':
      return { ...session, feedback: { kind: 'invalid', error: result.error, input } }
  }
}

/** The learner gives up: the task counts as wrong and the model solution is shown. */
export function revealSolution(session: Session): Session {
  if (!currentTask(session) || isTaskFinished(session)) return session
  return finish(session, 'wrong', { kind: 'revealed' })
}

/** Moves on after a finished task; after the last one the series is over. */
export function nextTask(session: Session): Session {
  if (!isTaskFinished(session)) return session
  return { ...session, index: session.index + 1, feedback: null }
}

/** What happened between two states, if a task was finished in between. */
export function finishedBetween(before: Session, after: Session): FinishedTask | null {
  if (after.outcomes.length !== before.outcomes.length + 1) return null
  const correct = after.outcomes[after.outcomes.length - 1] === 'correct'
  const total = after.tasks.length
  return after.outcomes.length === total ? { correct, series: { correct: countCorrect(after), total } } : { correct }
}

/** The distinct variable letters of a task, e.g. ['x', 'y']; used for the input keys. */
export function taskVariables(prompt: string): string[] {
  return [...new Set(prompt.match(/[a-z]/g) ?? [])].sort()
}
