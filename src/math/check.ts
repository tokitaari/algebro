import type { Expr } from './ast'
import { TermError, toErrorInfo, type TermErrorInfo } from './errors'
import { checkForm, type FormHint, type FormRequirement } from './form'
import { toPolynomial } from './normalize'
import { parse } from './parser'
import type { Polynomial } from './polynomial'

export type ReadResult =
  | { ok: true; expr: Expr; polynomial: Polynomial }
  | { ok: false; error: TermErrorInfo }

/** Parses and evaluates learner input without throwing. */
export function readTerm(input: string): ReadResult {
  try {
    const expr = parse(input)
    return { ok: true, expr, polynomial: toPolynomial(expr) }
  } catch (e) {
    if (e instanceof TermError) return { ok: false, error: toErrorInfo(e) }
    throw e
  }
}

/** What an answer is checked against; satisfied by every generated Task. */
export interface AnswerKey {
  expected: Polynomial
  form: FormRequirement
}

export type CheckResult =
  /** Equivalent and in the requested form. */
  | { kind: 'correct' }
  /** Not equivalent to the expected term. */
  | { kind: 'wrong' }
  /** Equivalent, but not in the requested form (e.g. brackets left). */
  | { kind: 'wrong-form'; hint: FormHint }
  /** Input could not be read as a term. */
  | { kind: 'invalid'; error: TermErrorInfo }

/**
 * Checks an answer: first algebraic equivalence (order and notation do not
 * matter), then the required form.
 */
export function checkAnswer(key: AnswerKey, input: string): CheckResult {
  const read = readTerm(input)
  if (!read.ok) return { kind: 'invalid', error: read.error }
  if (!read.polynomial.equals(key.expected)) return { kind: 'wrong' }
  const hint = checkForm(read.expr, key.form)
  return hint ? { kind: 'wrong-form', hint } : { kind: 'correct' }
}
