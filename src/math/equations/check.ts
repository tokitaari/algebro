import type { TermErrorInfo } from '../errors'
import { haveSameSolutions, readEquation, sidePolynomials } from './equation'
import { operationProblem, transformSides } from './operation'
import type { Equation, Operation } from './types'

export type StepCheckResult =
  /** Both sides are equivalent to "previous side ∘ operation". */
  | { kind: 'correct'; equation: Equation }
  /**
   * At least one side does not match the stated operation. `left`/`right`
   * tell which sides are fine. `keepsSolutions` is true if the line still has
   * the same solutions as the line before, i.e. the line itself is a valid
   * consequence, but not of the stated operation (e.g. two steps at once).
   */
  | { kind: 'wrong'; equation: Equation; left: boolean; right: boolean; keepsSolutions: boolean }
  /** Input could not be read as an equation. */
  | { kind: 'invalid'; error: TermErrorInfo }

/**
 * Checks one line of a solution against the line before and the stated
 * operation. How far each side is simplified does not matter:
 * - `+ T`, `− T`, `· c`, `: c`: each side must be equivalent to the previous
 *   side with the operation applied
 * - `simplify`: each side must be equivalent to the same side before
 * - `swap`: each side must be equivalent to the other side before
 *
 * @throws RangeError if `operation` is not allowed (see `operationProblem`);
 * operations from `readOperation` are always allowed.
 */
export function checkStep(previous: Equation, operation: Operation, input: string): StepCheckResult {
  const found = operationProblem(operation)
  if (found) throw new RangeError(`Operation is not allowed: ${found.code}`)
  const read = readEquation(input)
  if (!read.ok) return { kind: 'invalid', error: read.error }
  const expected = transformSides(sidePolynomials(previous), operation)
  const left = read.left.equals(expected.left)
  const right = read.right.equals(expected.right)
  if (left && right) return { kind: 'correct', equation: read.equation }
  return {
    kind: 'wrong',
    equation: read.equation,
    left,
    right,
    keepsSolutions: haveSameSolutions(previous, read.equation),
  }
}
