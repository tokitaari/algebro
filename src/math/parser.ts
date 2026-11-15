import type { Expr, Span } from './ast'
import { TermError } from './errors'
import { Rational } from './rational'

/** Longest accepted input; protects against pathological input. */
export const MAX_INPUT_LENGTH = 200
/** Largest accepted exponent. */
export const MAX_EXPONENT = 12

type OperatorKind = 'plus' | 'minus' | 'times' | 'divide' | 'caret'

type Token =
  | { kind: 'num'; value: Rational; text: string; pos: number; end: number; spaceBefore: boolean }
  | { kind: 'var'; name: string; text: string; pos: number; end: number; spaceBefore: boolean }
  | { kind: OperatorKind; text: string; pos: number; end: number; spaceBefore: boolean }
  | { kind: 'open' | 'close'; bracket: '(' | '['; text: string; pos: number; end: number; spaceBefore: boolean }
  | { kind: 'sup'; value: number; text: string; pos: number; end: number; spaceBefore: boolean }
  | { kind: 'eof'; text: string; pos: number; end: number; spaceBefore: boolean }

const OPERATORS: Record<string, OperatorKind> = {
  '+': 'plus',
  '-': 'minus',
  '−': 'minus', // − minus sign
  '–': 'minus', // – en dash (auto-correct on phones)
  '*': 'times',
  '·': 'times', // · middle dot
  '⋅': 'times', // ⋅ dot operator
  '×': 'times', // × multiplication sign
  '/': 'divide',
  ':': 'divide',
  '÷': 'divide', // ÷
  '^': 'caret',
}

const SUPERSCRIPT_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let spaceBefore = false
  while (i < input.length) {
    const ch = input.charAt(i)
    if (/\s/.test(ch)) {
      i++
      spaceBefore = true
      continue
    }
    const start = i
    const push = (token: Token) => {
      tokens.push(token)
      spaceBefore = false
    }

    if (/[0-9]/.test(ch)) {
      while (/[0-9]/.test(input.charAt(i))) i++
      if (/[.,]/.test(input.charAt(i))) {
        i++
        if (!/[0-9]/.test(input.charAt(i))) {
          throw new TermError(
            'invalid-number',
            `Die Zahl „${input.slice(start, i)}“ ist unvollständig.`,
            start,
            i - start,
          )
        }
        while (/[0-9]/.test(input.charAt(i))) i++
      }
      const text = input.slice(start, i)
      const value = Rational.parseDecimal(text)
      if (!value) throw new TermError('invalid-number', `„${text}“ ist keine gültige Zahl.`, start, i - start)
      push({ kind: 'num', value, text, pos: start, end: i, spaceBefore })
      continue
    }

    if (/[a-zA-Z]/.test(ch)) {
      // Uppercase is folded: phones often capitalise the first letter.
      push({ kind: 'var', name: ch.toLowerCase(), text: ch, pos: start, end: i + 1, spaceBefore })
      i++
      continue
    }

    if (SUPERSCRIPT_DIGITS.includes(ch)) {
      let digits = ''
      while (i < input.length && SUPERSCRIPT_DIGITS.includes(input.charAt(i))) {
        digits += String(SUPERSCRIPT_DIGITS.indexOf(input.charAt(i)))
        i++
      }
      push({ kind: 'sup', value: Number(digits), text: input.slice(start, i), pos: start, end: i, spaceBefore })
      continue
    }

    const op = OPERATORS[ch]
    if (op) {
      push({ kind: op, text: ch, pos: start, end: i + 1, spaceBefore })
      i++
      continue
    }

    if (ch === '(' || ch === '[') {
      push({ kind: 'open', bracket: ch, text: ch, pos: start, end: i + 1, spaceBefore })
      i++
      continue
    }
    if (ch === ')' || ch === ']') {
      push({ kind: 'close', bracket: ch === ')' ? '(' : '[', text: ch, pos: start, end: i + 1, spaceBefore })
      i++
      continue
    }

    throw new TermError('invalid-character', `Das Zeichen „${ch}“ ist hier nicht erlaubt.`, start)
  }
  tokens.push({ kind: 'eof', text: '', pos: input.length, end: input.length, spaceBefore })
  return tokens
}

function isOperator(token: Token): boolean {
  return (
    token.kind === 'plus' ||
    token.kind === 'minus' ||
    token.kind === 'times' ||
    token.kind === 'divide' ||
    token.kind === 'caret'
  )
}

class Parser {
  private readonly tokens: Token[]
  private index = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  parse(): Expr {
    const expr = this.parseExpression()
    const tok = this.peek()
    if (tok.kind === 'close') {
      throw new TermError('missing-opening-bracket', 'Zu dieser Klammer fehlt die öffnende Klammer.', tok.pos)
    }
    if (tok.kind !== 'eof') this.unexpected(tok)
    return expr
  }

  private peek(): Token {
    // The token list always ends with eof, and we never advance past it.
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1]!
  }

  private previous(): Token | undefined {
    return this.tokens[this.index - 1]
  }

  private next(): Token {
    const tok = this.peek()
    if (tok.kind !== 'eof') this.index++
    return tok
  }

  private lastEnd(): number {
    return this.previous()?.end ?? 0
  }

  private span(start: number): Span {
    return { start, end: this.lastEnd() }
  }

  /** expression := ('+' | '-')? term (('+' | '-') term)* */
  private parseExpression(): Expr {
    const start = this.peek().pos
    const terms: Expr[] = []
    let first = true
    for (;;) {
      const tok = this.peek()
      let negative = false
      if (tok.kind === 'plus' || tok.kind === 'minus') {
        this.next()
        negative = tok.kind === 'minus'
      } else if (!first) {
        break
      }
      const term = this.parseTerm()
      terms.push(negative ? { type: 'neg', arg: term, span: { start: tok.pos, end: this.lastEnd() } } : term)
      first = false
    }
    if (terms.length === 1 && terms[0]) return terms[0]
    return { type: 'add', terms, span: this.span(start) }
  }

  /** term := power (('*' | '/') power | power)*, where juxtaposition needs a letter or bracket. */
  private parseTerm(): Expr {
    this.expectOperand()
    const start = this.peek().pos
    let factors: Expr[] = [this.parsePower()]
    for (;;) {
      const tok = this.peek()
      if (tok.kind === 'times' || tok.kind === 'divide') {
        this.next()
        this.expectOperand()
        const rhs = this.parsePower()
        if (tok.kind === 'divide') {
          const lhs: Expr =
            factors.length === 1 && factors[0] ? factors[0] : { type: 'mul', factors, span: this.spanOf(factors) }
          factors = [{ type: 'div', num: lhs, den: rhs, span: this.span(start) }]
        } else {
          factors.push(rhs)
        }
      } else if (tok.kind === 'var' || tok.kind === 'open') {
        factors.push(this.parsePower())
      } else if (tok.kind === 'num') {
        this.missingOperatorBeforeNumber(tok)
      } else if (tok.kind === 'sup') {
        throw new TermError('double-exponent', 'Hier steht eine Hochzahl zu viel.', tok.pos, tok.end - tok.pos)
      } else {
        break
      }
    }
    if (factors.length === 1 && factors[0]) return factors[0]
    return { type: 'mul', factors, span: this.span(start) }
  }

  /** power := atom ('^' exponent | superscript)? */
  private parsePower(): Expr {
    const start = this.peek().pos
    const base = this.parseAtom()
    const tok = this.peek()
    let exp: number
    if (tok.kind === 'caret') {
      this.next()
      exp = this.parseExponent()
    } else if (tok.kind === 'sup') {
      this.next()
      exp = this.checkExponent(tok.value, tok)
    } else {
      return base
    }
    const after = this.peek()
    if (after.kind === 'caret' || after.kind === 'sup') {
      throw new TermError(
        'double-exponent',
        'Setze Klammern, wenn du eine Potenz noch einmal potenzierst, z. B. (x²)³.',
        after.pos,
        after.end - after.pos,
      )
    }
    return { type: 'pow', base, exp, span: this.span(start) }
  }

  /** exponent := integer | '(' integer ')' */
  private parseExponent(): number {
    const tok = this.next()
    if (tok.kind === 'num') {
      return this.checkExponent(tok.value, tok)
    }
    if (tok.kind === 'open') {
      const inner = this.next()
      const close = this.next()
      if (inner.kind === 'num' && close.kind === 'close' && close.bracket === tok.bracket) {
        return this.checkExponent(inner.value, inner)
      }
    }
    throw new TermError(
      'invalid-exponent',
      'Als Hochzahl ist nur eine natürliche Zahl erlaubt, z. B. x^2.',
      tok.pos,
      Math.max(1, tok.end - tok.pos),
    )
  }

  private checkExponent(value: Rational | number, tok: Token): number {
    // Superscript runs arrive as plain numbers and may be absurdly long.
    const r = typeof value === 'number' ? Rational.of(Math.min(value, MAX_EXPONENT + 1)) : value
    if (!r.isInteger()) {
      throw new TermError(
        'invalid-exponent',
        'Als Hochzahl ist nur eine natürliche Zahl erlaubt, z. B. x^2.',
        tok.pos,
        tok.end - tok.pos,
      )
    }
    if (r.compare(Rational.of(MAX_EXPONENT)) > 0) {
      throw new TermError(
        'exponent-too-large',
        `Die Hochzahl ist zu groß (höchstens ${MAX_EXPONENT}).`,
        tok.pos,
        tok.end - tok.pos,
      )
    }
    return Number(r.num)
  }

  /** atom := number | variable | '(' expression ')' */
  private parseAtom(): Expr {
    const tok = this.next()
    switch (tok.kind) {
      case 'num':
        return { type: 'num', value: tok.value, span: { start: tok.pos, end: tok.end } }
      case 'var':
        return { type: 'var', name: tok.name, span: { start: tok.pos, end: tok.end } }
      case 'open': {
        if (this.peek().kind === 'close') {
          throw new TermError('empty-brackets', 'Die Klammer ist leer.', tok.pos, this.peek().end - tok.pos)
        }
        const body = this.parseExpression()
        const close = this.peek()
        if (close.kind === 'close') {
          if (close.bracket !== tok.bracket) {
            throw new TermError(
              'mismatched-bracket',
              `Die Klammer „${close.text}“ passt nicht zu „${tok.text}“.`,
              close.pos,
            )
          }
          this.next()
          return { type: 'group', body, span: { start: tok.pos, end: close.end } }
        }
        if (close.kind === 'eof') {
          throw new TermError('missing-closing-bracket', 'Es fehlt eine schließende Klammer.', tok.pos)
        }
        return this.unexpected(close)
      }
      default:
        return this.unexpected(tok)
    }
  }

  /** Ensures the next token can start an operand; otherwise explains why not. */
  private expectOperand(): void {
    const tok = this.peek()
    if (tok.kind === 'num' || tok.kind === 'var' || tok.kind === 'open') return
    const prev = this.previous()
    if (isOperator(tok) && prev && isOperator(prev)) {
      throw new TermError(
        'double-operator',
        'Hier stehen zwei Rechenzeichen hintereinander. Setze Klammern, z. B. x·(-3).',
        tok.pos,
      )
    }
    if ((tok.kind === 'eof' || tok.kind === 'close') && prev) {
      if (prev.kind === 'open' && tok.kind === 'close') {
        throw new TermError('empty-brackets', 'Die Klammer ist leer.', prev.pos, tok.end - prev.pos)
      }
      throw new TermError(
        'missing-operand',
        `Der Term ist unvollständig: Nach „${prev.text}“ fehlt noch etwas.`,
        prev.pos,
      )
    }
    this.unexpected(tok)
  }

  private missingOperatorBeforeNumber(tok: Token & { kind: 'num' }): never {
    const prev = this.previous()
    if (prev?.kind === 'var' && !tok.spaceBefore) {
      throw new TermError(
        'missing-operator',
        `Meinst du ${prev.name}^${tok.text} (${prev.name} hoch ${tok.text})? ` +
          `Zum Malnehmen schreibe die Zahl vorne, z. B. ${tok.text}${prev.name}.`,
        prev.pos,
        tok.end - prev.pos,
      )
    }
    throw new TermError(
      'missing-operator',
      `Vor der Zahl „${tok.text}“ fehlt ein Rechenzeichen.`,
      tok.pos,
      tok.end - tok.pos,
    )
  }

  private unexpected(tok: Token): never {
    if (tok.kind === 'eof') {
      throw new TermError('missing-operand', 'Der Term ist unvollständig.', tok.pos)
    }
    throw new TermError('unexpected-token', `„${tok.text}“ passt hier nicht.`, tok.pos, tok.end - tok.pos)
  }

  private spanOf(nodes: Expr[]): Span | undefined {
    const first = nodes[0]?.span
    const last = nodes[nodes.length - 1]?.span
    return first && last ? { start: first.start, end: last.end } : undefined
  }
}

/**
 * Parses learner input such as `x^2+6x+9`, `(x+3)(x−3)`, `3x(2x+3)` or `x²+6x+9`.
 *
 * Accepted syntax:
 * - numbers with `.` or `,` as decimal separator, single-letter variables
 *   (uppercase is folded to lowercase)
 * - `+`, `-` (also `−`, `–`), `*` (also `·`, `⋅`, `×`), `/` (also `:`, `÷`)
 * - powers with `^n`, `^(n)` or superscript digits (`x²`), 0 ≤ n ≤ MAX_EXPONENT
 * - round or square brackets
 * - implicit multiplication before a letter or a bracket (`2x`, `ab`, `3(x+1)`, `(x+1)(x-1)`)
 *
 * A sign is only allowed at the start of an expression or bracket, so
 * `x+-3` must be written as `x+(-3)` (school notation).
 *
 * @throws TermError with a German message and the position of the problem.
 */
export function parse(input: string): Expr {
  if (input.trim() === '') throw new TermError('empty', 'Bitte gib einen Term ein.', 0, 0)
  if (input.length > MAX_INPUT_LENGTH) {
    throw new TermError('too-long', `Der Term ist zu lang (höchstens ${MAX_INPUT_LENGTH} Zeichen).`, 0, input.length)
  }
  return new Parser(tokenize(input)).parse()
}
