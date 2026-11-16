import {
  operationToLatex,
  parse,
  readEquation,
  readOperation,
  readSolutionSet,
  solutionSetToLatex,
  toLatex,
  type Expr,
} from '../math'

/**
 * Minimal markup for explanation texts: `$…$` encloses a term in input syntax
 * (the same syntax learners type, e.g. `$(a+b)^2 = a^2+2ab+b^2$`). Terms are
 * parsed and printed with `toLatex`, so prose and exercises use the same
 * typesetting. A term may be a chain joined by ` = ` or ` ≠ `; the content
 * tests check that every such claim is mathematically true.
 *
 * An equation is not a claim but a condition on x, so it is written with the
 * prefix `eq:` (see `equationPieces`): `$eq: 3x + 2 = x + 8$`, with the
 * operation written next to it `$eq: 3x + 2 = x + 8 | - x$`, an operation
 * alone `$eq: | : 2$`, or a solution set `$eq: L = {3}$`. The content tests
 * check that these can be read, not that they are true.
 */
export type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'math'; source: string }
  | { kind: 'equation'; source: string }

/** Marks an equation segment, e.g. `$eq: 2x = 6$`. */
export const EQUATION_PREFIX = 'eq:'

export function splitMarkup(text: string): Segment[] {
  const parts = text.split('$')
  if (parts.length % 2 === 0) throw new Error(`Unbalanced "$" in: ${text}`)
  return parts
    .map((part, i): Segment => {
      if (i % 2 === 0) return { kind: 'text', text: part }
      const trimmed = part.trimStart()
      return trimmed.startsWith(EQUATION_PREFIX)
        ? { kind: 'equation', source: trimmed.slice(EQUATION_PREFIX.length).trim() }
        : { kind: 'math', source: part }
    })
    .filter((s) => s.kind !== 'text' || s.text !== '')
}

/** LaTeX pieces of a math or equation segment; line breaks are allowed only between pieces. */
export function segmentPieces(segment: Exclude<Segment, { kind: 'text' }>): string[] {
  return segment.kind === 'math' ? chainPieces(segment.source) : equationPieces(segment.source)
}

/**
 * LaTeX pieces of an equation segment (without the `eq:` prefix): the left
 * side, `= right side`, then the operation; or the solution set alone. Both
 * sides keep the multiplication dots written in the source.
 *
 * @throws Error if the source is not an equation, an operation or a solution set.
 */
export function equationPieces(source: string): string[] {
  const text = source.trim()
  if (/^L\s*=/.test(text)) {
    const read = readSolutionSet(text)
    if (!read.ok) throw new Error(`Not a solution set: "${source}" (${read.error.message})`)
    return [solutionSetToLatex(read.solutionSet)]
  }
  const bar = text.indexOf('|')
  const equation = (bar < 0 ? text : text.slice(0, bar)).trim()
  const operation = bar < 0 ? '' : text.slice(bar)
  const pieces: string[] = []
  if (equation !== '') {
    const read = readEquation(equation)
    if (!read.ok) throw new Error(`Not an equation: "${source}" (${read.error.message})`)
    const equals = equation.indexOf('=')
    pieces.push(termToLatex(equation.slice(0, equals).trim()), `= ${termToLatex(equation.slice(equals + 1).trim())}`)
  }
  if (operation !== '') {
    const read = readOperation(operation)
    if (!read.ok) throw new Error(`Not an allowed operation: "${source}" (${read.error.message})`)
    pieces.push(operationToLatex(read.operation))
  }
  if (pieces.length === 0) throw new Error(`Empty equation segment: "${source}"`)
  return pieces
}

/** LaTeX for a whole equation segment, e.g. `3x + 2 = x + 8 \mid\; {-}\, x`. */
export function equationToLatexMarkup(source: string): string {
  return equationPieces(source).join(' ')
}

export type Relation = '=' | '≠'

/** A term chain such as `a = b ≠ c`: the terms and the relations between neighbours. */
export interface Chain {
  terms: string[]
  relations: Relation[]
}

export function splitChain(source: string): Chain {
  const tokens = source.split(/\s*(=|≠)\s*/)
  const terms: string[] = []
  const relations: Relation[] = []
  tokens.forEach((token, i) => {
    if (i % 2 === 0) terms.push(token.trim())
    else relations.push(token as Relation)
  })
  return { terms, relations }
}

/**
 * LaTeX pieces of a term chain: the first term, then each relation with the
 * following term, e.g. `x \cdot x`, `\neq 2x`. Line breaks are allowed only
 * between pieces, never inside a term.
 */
export function chainPieces(source: string): string[] {
  const { terms, relations } = splitChain(source)
  return terms.map((term, i) => {
    const latex = termToLatex(term)
    return i === 0 ? latex : `${relations[i - 1] === '≠' ? '\\neq' : '='} ${latex}`
  })
}

/** LaTeX for a whole term chain from the markup, e.g. `x \cdot x \neq 2x`. */
export function chainToLatex(source: string): string {
  return chainPieces(source).join(' ')
}

/**
 * LaTeX for a single term in input syntax. Multiplication dots written in the
 * source (e.g. `3·(-5)`, `a·a`) are kept, because the parser only records the
 * product, not how it was written.
 */
export function termToLatex(term: string): string {
  return toLatex(keepDots(parse(term), term))
}

const DOT = /[·*×]/

function keepDots(e: Expr, source: string): Expr {
  switch (e.type) {
    case 'mul': {
      const factors = e.factors.map((f) => keepDots(f, source))
      const explicit = factors.some((f, i) => {
        const prev = factors[i - 1]
        return prev?.span !== undefined && f.span !== undefined && DOT.test(source.slice(prev.span.end, f.span.start))
      })
      return { ...e, factors, explicit: e.explicit || explicit }
    }
    case 'add':
      return { ...e, terms: e.terms.map((t) => keepDots(t, source)) }
    case 'neg':
      return { ...e, arg: keepDots(e.arg, source) }
    case 'group':
      return { ...e, body: keepDots(e.body, source) }
    case 'pow':
      return { ...e, base: keepDots(e.base, source) }
    case 'div':
      return { ...e, num: keepDots(e.num, source), den: keepDots(e.den, source) }
    default:
      return e
  }
}
