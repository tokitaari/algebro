import { parse, toLatex, type Expr } from '../math'

/**
 * Minimal markup for explanation texts: `$…$` encloses a term in input syntax
 * (the same syntax learners type, e.g. `$(a+b)^2 = a^2+2ab+b^2$`). Terms are
 * parsed and printed with `toLatex`, so prose and exercises use the same
 * typesetting. A term may be a chain joined by ` = ` or ` ≠ `; the content
 * tests check that every such claim is mathematically true.
 */
export type Segment = { kind: 'text'; text: string } | { kind: 'math'; source: string }

export function splitMarkup(text: string): Segment[] {
  const parts = text.split('$')
  if (parts.length % 2 === 0) throw new Error(`Unbalanced "$" in: ${text}`)
  return parts
    .map((part, i): Segment => (i % 2 === 0 ? { kind: 'text', text: part } : { kind: 'math', source: part }))
    .filter((s) => s.kind === 'math' || s.text !== '')
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
