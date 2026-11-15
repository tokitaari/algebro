import { add, mul, neg, num, times } from '../ast'
import { termToExpr } from '../normalize'
import { Polynomial } from '../polynomial'
import { toText } from '../printer'
import { intGcd, pick, pickWeighted, randInt, randNonZero, type Rng } from '../random'
import {
  coprimeParts,
  expandedValue,
  factoredForm,
  substitutedForm,
  type BinomialKind,
  type BinomialParts,
} from './binomial'
import { ex, makeTask, mono, pickVar, pickVarPair, sum } from './helpers'
import type { Task } from './types'

type Variant =
  | 'common-number'
  | 'common-monomial'
  | 'common-trinomial'
  | 'common-two-variables'
  | 'binomial'
  | 'binomial-two-variables'
  | 'common-then-binomial'

const VARIANTS: readonly (readonly [Variant, number])[] = [
  ['common-number', 2], // 4x + 8 = 4(x + 2)
  ['common-monomial', 3], // 6x² + 9x = 3x(2x + 3)
  ['common-trinomial', 1], // 2x³ - 4x² + 6x = 2x(x² - 2x + 3)
  ['common-two-variables', 1], // 6a² + 9ab = 3a(2a + 3b)
  ['binomial', 5], // x² + 6x + 9 = (x + 3)², 4x² - 9 = (2x + 3)(2x - 3)
  ['binomial-two-variables', 1], // a² - 4b² = (a + 2b)(a - 2b)
  ['common-then-binomial', 2], // 2x² + 12x + 18 = 2(x + 3)²
]

const BACKWARD_NOTES: Record<BinomialKind, string> = {
  plus: '1. binomische Formel rückwärts: a² + 2ab + b² = (a + b)²',
  minus: '2. binomische Formel rückwärts: a² - 2ab + b² = (a - b)²',
  conjugate: '3. binomische Formel rückwärts: a² - b² = (a + b)(a - b)',
}

const KINDS: readonly BinomialKind[] = ['plus', 'minus', 'conjugate']

/** p·x + q with gcd(p, q) = 1, so nothing can be factored out of it. */
function linearInner(rng: Rng, x: string): Polynomial {
  for (;;) {
    const p = randInt(rng, 1, 6)
    const q = randNonZero(rng, 9)
    if (intGcd(p, q) === 1) return sum(mono(p, x), mono(q))
  }
}

/** a·x² + b·x + c, primitive and without real roots, so it is fully factored. */
function trinomialInner(rng: Rng, x: string): Polynomial {
  for (;;) {
    const a = randInt(rng, 1, 3)
    const b = randNonZero(rng, 6)
    const c = randInt(rng, 1, 9)
    if (b * b < 4 * a * c && intGcd(intGcd(a, b), c) === 1) {
      return sum(mono(a, x, 2), mono(b, x), mono(c))
    }
  }
}

/** p·a + q·b with gcd(p, q) = 1. */
function twoVariableInner(rng: Rng, a: string, b: string): Polynomial {
  for (;;) {
    const p = randInt(rng, 1, 5)
    const q = randNonZero(rng, 5)
    if (intGcd(p, q) === 1) return sum(mono(p, a), mono(q, b))
  }
}

function commonFactorTask(variant: Variant, factor: Polynomial, inner: Polynomial): Task {
  const g = ex(factor)
  return makeTask({
    topic: 'faktorisieren',
    variant,
    instruction: 'Klammere den größten gemeinsamen Faktor aus.',
    prompt: ex(factor.mul(inner)),
    form: { kind: 'factored', sumFactors: 1 },
    steps: [
      {
        expr: add(
          ...inner.terms().map((t) => {
            const product = times(g, termToExpr({ coef: t.coef.abs(), mono: t.mono }))
            return t.coef.sign() < 0 ? neg(product) : product
          }),
        ),
        note: `Gemeinsamer Faktor aller Summanden: ${toText(g)}`,
      },
      { expr: mul(g, ex(inner)), note: 'Den gemeinsamen Faktor vor die Klammer schreiben.' },
    ],
  })
}

function binomialTask(variant: Variant, kind: BinomialKind, parts: BinomialParts, rng: Rng): Task {
  return makeTask({
    topic: 'faktorisieren',
    variant: `${variant}-${kind}`,
    instruction: 'Faktorisiere mit einer binomischen Formel.',
    prompt: ex(expandedValue(kind, parts)),
    form: { kind: 'factored', sumFactors: 2 },
    steps: [
      { expr: substitutedForm(kind, parts), note: BACKWARD_NOTES[kind] },
      { expr: factoredForm(kind, parts, rng() < 0.3), note: 'Als Produkt schreiben.' },
    ],
  })
}

function commonThenBinomialTask(rng: Rng): Task {
  const k = randInt(rng, 2, 5)
  const kind = pick(rng, KINDS)
  // Smaller numbers than in the plain binomial variant: the factor k scales everything.
  const x = pickVar(rng)
  let p: number
  let q: number
  do {
    p = pick(rng, [1, 1, 1, 2, 3])
    q = randInt(rng, 1, 6)
  } while (intGcd(p, q) !== 1)
  const parts: BinomialParts = { a: mono(p, x), b: mono(q) }
  const inner = expandedValue(kind, parts)
  return makeTask({
    topic: 'faktorisieren',
    variant: `common-then-binomial-${kind}`,
    instruction: 'Faktorisiere so weit wie möglich.',
    prompt: ex(inner.scale(k)),
    form: { kind: 'factored', sumFactors: 2 },
    steps: [
      { expr: mul(num(k), ex(inner)), note: `Zuerst den gemeinsamen Faktor ${k} ausklammern.` },
      { expr: mul(num(k), substitutedForm(kind, parts)), note: BACKWARD_NOTES[kind] },
      { expr: mul(num(k), factoredForm(kind, parts)), note: 'Als Produkt schreiben.' },
    ],
  })
}

/**
 * Subtopic 3: factor a term, either by taking out the greatest common factor
 * or with a binomial formula backwards (or both). All generated terms have
 * integer coefficients and a unique complete factorisation at class-8 level.
 */
export function generateFactorTask(rng: Rng): Task {
  const variant = pickWeighted(rng, VARIANTS)
  switch (variant) {
    case 'common-number': {
      const x = pickVar(rng)
      return commonFactorTask(variant, mono(randInt(rng, 2, 9)), linearInner(rng, x))
    }
    case 'common-monomial': {
      const x = pickVar(rng)
      const factor = mono(randInt(rng, 1, 6), x, rng() < 0.75 ? 1 : 2)
      return commonFactorTask(variant, factor, linearInner(rng, x))
    }
    case 'common-trinomial': {
      const x = pickVar(rng)
      const factor = rng() < 0.5 ? mono(randInt(rng, 2, 6)) : mono(randInt(rng, 1, 4), x)
      return commonFactorTask(variant, factor, trinomialInner(rng, x))
    }
    case 'common-two-variables': {
      const [a, b] = pickVarPair(rng)
      const k = randInt(rng, 1, 6)
      const factor = rng() < 0.6 ? Polynomial.monomial(k, { [a]: 1 }) : Polynomial.monomial(k, { [a]: 1, [b]: 1 })
      return commonFactorTask(variant, factor, twoVariableInner(rng, a, b))
    }
    case 'binomial':
      return binomialTask(variant, pick(rng, KINDS), coprimeParts(rng, false), rng)
    case 'binomial-two-variables':
      return binomialTask(variant, pick(rng, KINDS), coprimeParts(rng, true), rng)
    case 'common-then-binomial':
      return commonThenBinomialTask(rng)
  }
}
