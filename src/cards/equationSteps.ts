import { termToLatex } from '../content/markup'
import type { Markup } from '../content/types'
import {
  checkStep,
  equalSolutionSets,
  operationToLatex,
  parse,
  readEquation,
  readOperation,
  readSolutionSet,
  solutionSetToLatex,
  solutionSetToText,
  solveEquation,
  toLatex,
  toText,
  type Equation,
  type Expr,
  type Operation,
} from '../math'
import type { EquationStepsWidget } from './types'

/*
 * Logic of the equation-steps widget (no React): checks, the planned steps
 * and what is shown after each click. A step with `+`, `−`, `·` or `:` takes
 * two frames: first an intermediate line with the operation written onto
 * both sides, then the line of the author, which replaces the intermediate
 * line. "Term umformen" and "⇄" take one frame, the solution set one more.
 * In the end the list reads like a solution in a notebook.
 */

type Arithmetic = Extract<Operation, { operand: Expr }>
type ArithmeticKind = Arithmetic['kind']

/** One side of an intermediate line: the side before, then the highlighted operation. */
export interface AppendedSide {
  /** LaTeX of the side before, in brackets if the operation needs them, e.g. `(3x + 2)`. */
  base: string
  /** LaTeX of what is written onto the side, e.g. `{-}\, x`. */
  operand: string
}

export interface PlannedEquationStep {
  /** LaTeX of the operation as written next to the line before, e.g. `\mid\; {-}\, x`. */
  operation: string
  note?: Markup
  /** LaTeX of the new line. */
  result: string
  /** Text of the new line for screen readers. */
  resultText: string
  kind: Operation['kind']
  /** Only for `+`, `−`, `·`, `:`: the intermediate line. */
  intermediate?: { left: AppendedSide; right: AppendedSide; text: string; words: string }
}

export type EquationStepsPhase = { kind: 'apply' | 'done'; step: number } | { kind: 'solution' }

export interface EquationStepsModel {
  start: { latex: string; text: string }
  steps: PlannedEquationStep[]
  solution?: { latex: string; text: string }
  /** What each click adds; the widget shows the first `frame` phases. */
  phases: EquationStepsPhase[]
}

export type EquationStepsRow =
  /** A line of the solution; `operation` and `note` are written next to it once the next step has begun. */
  | { kind: 'equation'; key: string; latex: string; operation?: string; note?: Markup }
  /** The operation written onto both sides of the line before, not yet simplified. */
  | { kind: 'intermediate'; key: string; left: AppendedSide; right: AppendedSide }
  | { kind: 'solution'; key: string; latex: string }

/** Problems of the widget (empty if it is fine); `validateDeck` reports them with the card. */
export function equationStepsProblems(widget: EquationStepsWidget): string[] {
  const read = readEquation(widget.start)
  if (!read.ok) return [`equation-steps: start "${widget.start}" does not parse`]
  const solution = solveEquation(read.equation)
  if (!solution) return [`equation-steps: start "${widget.start}" must be linear in one variable`]
  if (widget.steps.length === 0) return ['equation-steps: no steps']

  const problems: string[] = []
  let previous: Equation = read.equation
  for (const step of widget.steps) {
    const operation = readOperation(step.operation)
    if (!operation.ok) {
      problems.push(`equation-steps: operation "${step.operation}" is ${operation.reason} (${operation.error.message})`)
      break
    }
    const result = checkStep(previous, operation.operation, step.equation)
    if (result.kind !== 'correct') {
      problems.push(`equation-steps: "${step.equation}" does not follow from the line before with "${step.operation}" (${result.kind})`)
      break
    }
    previous = result.equation
  }
  if (widget.solution !== undefined) {
    const given = readSolutionSet(widget.solution)
    if (!given.ok) problems.push(`equation-steps: solution "${widget.solution}" does not parse`)
    else if (!equalSolutionSets(given.solutionSet, solution)) {
      problems.push(`equation-steps: solution "${widget.solution}" is not ${solutionSetToText(solution)}`)
    }
  }
  return problems
}

/** Splits a line in input syntax at its "=" (the line is known to parse). */
function sidesOf(source: string): [string, string] {
  const equals = source.indexOf('=')
  return [source.slice(0, equals).trim(), source.slice(equals + 1).trim()]
}

function lineLatex(source: string): string {
  const [left, right] = sidesOf(source)
  return `${termToLatex(left)} = ${termToLatex(right)}`
}

function lineText(source: string): string {
  const [left, right] = sidesOf(source)
  return `${toText(parse(left))} = ${toText(parse(right))}`
}

const LATEX_SIGNS: Record<ArithmeticKind, string> = {
  add: '{+}',
  subtract: '{-}',
  multiply: '{\\cdot}',
  divide: '{:}',
}
const TEXT_SIGNS: Record<ArithmeticKind, string> = { add: '+', subtract: '-', multiply: '·', divide: ':' }
const WORDS: Record<ArithmeticKind, string> = { add: 'plus', subtract: 'minus', multiply: 'mal', divide: 'geteilt durch' }

/** Operand as printed after the sign: sums and negative terms get brackets (as in `operationToLatex`). */
function bracketedOperand(print: (e: Expr) => string, operand: Expr): string {
  const printed = print(operand)
  return operand.type === 'add' || printed.startsWith('-') ? `(${printed})` : printed
}

/** A side before `·` or `:` needs brackets if it is a sum, e.g. `(3x + 2) · 2`. */
function needsBrackets(kind: ArithmeticKind, side: Expr): boolean {
  return (kind === 'multiply' || kind === 'divide') && side.type === 'add'
}

function appended(operation: Arithmetic, source: string): { side: AppendedSide; text: string } {
  const expr = parse(source)
  const wrap = needsBrackets(operation.kind, expr)
  const latex = termToLatex(source)
  const text = toText(expr)
  const operandLatex = `${LATEX_SIGNS[operation.kind]}\\, ${bracketedOperand(toLatex, operation.operand)}`
  const operandText = `${TEXT_SIGNS[operation.kind]} ${bracketedOperand(toText, operation.operand)}`
  return {
    side: { base: wrap ? `(${latex})` : latex, operand: operandLatex },
    text: `${wrap ? `(${text})` : text} ${operandText}`,
  }
}

/**
 * The planned steps and phases of a valid widget.
 *
 * @throws Error if the widget has problems (see `equationStepsProblems`).
 */
export function buildEquationSteps(widget: EquationStepsWidget): EquationStepsModel {
  const problems = equationStepsProblems(widget)
  if (problems.length > 0) throw new Error(problems.join('; '))

  let previous = widget.start
  const steps: PlannedEquationStep[] = []
  const phases: EquationStepsPhase[] = []
  widget.steps.forEach((step, index) => {
    const read = readOperation(step.operation)
    if (!read.ok) throw new Error(`Operation "${step.operation}" does not parse`)
    const operation = read.operation
    const planned: PlannedEquationStep = {
      operation: operationToLatex(operation),
      note: step.note,
      result: lineLatex(step.equation),
      resultText: lineText(step.equation),
      kind: operation.kind,
    }
    if (operation.kind !== 'simplify' && operation.kind !== 'swap') {
      const [left, right] = sidesOf(previous)
      const l = appended(operation, left)
      const r = appended(operation, right)
      planned.intermediate = {
        left: l.side,
        right: r.side,
        text: `${l.text} = ${r.text}`,
        words: `${WORDS[operation.kind]} ${bracketedOperand(toText, operation.operand)}`,
      }
      phases.push({ kind: 'apply', step: index })
    }
    phases.push({ kind: 'done', step: index })
    steps.push(planned)
    previous = step.equation
  })

  let solution: EquationStepsModel['solution']
  if (widget.solution !== undefined) {
    const read = readSolutionSet(widget.solution)
    if (!read.ok) throw new Error(`Solution "${widget.solution}" does not parse`)
    solution = { latex: solutionSetToLatex(read.solutionSet), text: solutionSetToText(read.solutionSet) }
    phases.push({ kind: 'solution' })
  }

  return { start: { latex: lineLatex(widget.start), text: lineText(widget.start) }, steps, solution, phases }
}

/** Number of clicks until everything is shown. */
export function frameCount(model: EquationStepsModel): number {
  return model.phases.length
}

/** Steps (and the solution set) to count, e.g. "2 von 4 Schritten". */
export function stepTotal(model: EquationStepsModel): number {
  return model.steps.length + (model.solution ? 1 : 0)
}

/** Steps that are complete after `frame` clicks; an intermediate line does not count yet. */
export function stepsDone(model: EquationStepsModel, frame: number): number {
  return model.phases.slice(0, frame).filter((phase) => phase.kind !== 'apply').length
}

/** The lines shown after `frame` clicks. */
export function equationStepsRows(model: EquationStepsModel, frame: number): EquationStepsRow[] {
  const rows: EquationStepsRow[] = [{ kind: 'equation', key: 'start', latex: model.start.latex }]
  /** Writes the operation of `step` next to the last line. */
  const tagLast = (step: PlannedEquationStep) => {
    const last = rows[rows.length - 1]
    if (last?.kind === 'equation') rows[rows.length - 1] = { ...last, operation: step.operation, note: step.note }
  }
  for (const phase of model.phases.slice(0, frame)) {
    if (phase.kind === 'solution') {
      if (model.solution) rows.push({ kind: 'solution', key: 'solution', latex: model.solution.latex })
      continue
    }
    const step = model.steps[phase.step]!
    if (phase.kind === 'apply') {
      tagLast(step)
      if (step.intermediate) {
        rows.push({ kind: 'intermediate', key: `apply-${phase.step}`, left: step.intermediate.left, right: step.intermediate.right })
      }
      continue
    }
    if (rows[rows.length - 1]?.kind === 'intermediate') rows.pop()
    else tagLast(step)
    rows.push({ kind: 'equation', key: `step-${phase.step}`, latex: step.result })
  }
  return rows
}

/** What screen readers hear after a click that showed `frame` phases; empty at the start. */
export function describeFrame(model: EquationStepsModel, frame: number): string {
  const phase = model.phases[frame - 1]
  if (!phase) return ''
  if (phase.kind === 'solution') return model.solution ? `Lösungsmenge: ${model.solution.text}.` : ''
  const step = model.steps[phase.step]!
  if (phase.kind === 'apply') {
    return step.intermediate ? `Auf beiden Seiten ${step.intermediate.words}: ${step.intermediate.text}.` : ''
  }
  switch (step.kind) {
    case 'simplify':
      return `Term umformen: ${step.resultText}.`
    case 'swap':
      return `Seiten tauschen: ${step.resultText}.`
    default:
      return `Zusammengefasst: ${step.resultText}.`
  }
}

/** Every LaTeX string the widget can show; content tests render them with KaTeX in strict mode. */
export function equationStepsLatex(model: EquationStepsModel): string[] {
  const latex = [model.start.latex]
  for (const step of model.steps) {
    latex.push(step.operation, step.result)
    if (step.intermediate) {
      const { left, right } = step.intermediate
      latex.push(`${left.base} ${left.operand} = ${right.base} ${right.operand}`)
    }
  }
  if (model.solution) latex.push(model.solution.latex)
  return latex
}

/** The sides of every line in input syntax (for `deckTerms`). */
export function equationStepsTerms(widget: EquationStepsWidget): string[] {
  return [widget.start, ...widget.steps.map((s) => s.equation)].flatMap(sidesOf)
}
