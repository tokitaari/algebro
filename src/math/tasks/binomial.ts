import { add, mul, neg, num, pow, sub, times, type Expr } from '../ast'
import type { Polynomial } from '../polynomial'
import { intGcd, pick, pickWeighted, randInt, type Rng } from '../random'
import { ex, makeTask, mono, pickVar, pickVarPair } from './helpers'
import type { SolutionStep, Task } from './types'

export type BinomialKind = 'plus' | 'minus' | 'conjugate'

export const FORMULA_NOTES: Record<BinomialKind, string> = {
  plus: '1. binomische Formel: (a + b)² = a² + 2ab + b²',
  minus: '2. binomische Formel: (a - b)² = a² - 2ab + b²',
  conjugate: '3. binomische Formel: (a + b)(a - b) = a² - b²',
}

/** The two terms A and B of a binomial formula, both with positive coefficient. */
export interface BinomialParts {
  a: Polynomial
  b: Polynomial
}

/**
 * Picks A = p·x and B = q (or B = q·y with two variables). Coefficients stay
 * small enough for mental arithmetic in class 8.
 */
export function pickBinomialParts(rng: Rng, twoVariables: boolean): BinomialParts {
  if (twoVariables) {
    const [x, y] = pickVarPair(rng)
    return { a: mono(randInt(rng, 1, 4), x), b: mono(randInt(rng, 1, 5), y) }
  }
  const x = pickVar(rng)
  const p = pick(rng, [1, 1, 1, 2, 2, 3, 4, 5])
  const q = randInt(rng, 1, p === 1 ? 12 : 9)
  return { a: mono(p, x), b: mono(q) }
}

/** Like pickBinomialParts, but with coprime coefficients so (A ± B) is primitive. */
export function coprimeParts(rng: Rng, twoVariables: boolean): BinomialParts {
  for (;;) {
    const parts = pickBinomialParts(rng, twoVariables)
    const [ta] = parts.a.terms()
    const [tb] = parts.b.terms()
    if (ta && tb && intGcd(Number(ta.coef.num), Number(tb.coef.num)) === 1) return parts
  }
}

/** The factored form: (A + B)², (A − B)² or (A + B)(A − B). */
export function factoredForm(kind: BinomialKind, { a, b }: BinomialParts, swapConjugate = false): Expr {
  const plus = ex(a.add(b))
  const minus = ex(a.sub(b))
  switch (kind) {
    case 'plus':
      return pow(plus, 2)
    case 'minus':
      return pow(minus, 2)
    case 'conjugate':
      return swapConjugate ? mul(minus, plus) : mul(plus, minus)
  }
}

/** The formula with A and B substituted, e.g. (2x)² + 2·2x·3 + 3². */
export function substitutedForm(kind: BinomialKind, { a, b }: BinomialParts): Expr {
  const A = ex(a)
  const B = ex(b)
  switch (kind) {
    case 'plus':
      return add(pow(A, 2), times(num(2), A, B), pow(B, 2))
    case 'minus':
      return add(pow(A, 2), neg(times(num(2), A, B)), pow(B, 2))
    case 'conjugate':
      return sub(pow(A, 2), pow(B, 2))
  }
}

/** The expanded result, e.g. 4x² + 12x + 9. */
export function expandedValue(kind: BinomialKind, { a, b }: BinomialParts): Polynomial {
  switch (kind) {
    case 'plus':
      return a.add(b).pow(2)
    case 'minus':
      return a.sub(b).pow(2)
    case 'conjugate':
      return a.add(b).mul(a.sub(b))
  }
}

const KINDS: readonly (readonly [BinomialKind, number])[] = [
  ['plus', 1],
  ['minus', 1],
  ['conjugate', 1],
]

/** Subtopic 2: expand with one of the three binomial formulas, e.g. (2x + 3)². */
export function generateBinomialTask(rng: Rng): Task {
  const kind = pickWeighted(rng, KINDS)
  const twoVariables = rng() < 0.25
  const parts = coprimeParts(rng, twoVariables)
  const swapConjugate = rng() < 0.3
  return buildBinomialTask(kind, parts, swapConjugate, twoVariables ? `${kind}-two-variables` : kind)
}

/**
 * Task "expand (A ± B)² or (A + B)(A − B)" with its worked solution. Used by the
 * generator and for fixed worked examples in the explanations.
 */
export function buildBinomialTask(
  kind: BinomialKind,
  parts: BinomialParts,
  swapConjugate = false,
  variant: string = kind,
): Task {
  const steps: SolutionStep[] = [
    { expr: substitutedForm(kind, parts), note: FORMULA_NOTES[kind] },
    { expr: ex(expandedValue(kind, parts)), note: 'Potenzen und Produkte ausrechnen.' },
  ]
  return makeTask({
    topic: 'algebra/terme/binomische-formeln',
    variant,
    instruction: 'Multipliziere mit einer binomischen Formel aus.',
    prompt: factoredForm(kind, parts, swapConjugate),
    form: { kind: 'expanded' },
    steps,
  })
}
