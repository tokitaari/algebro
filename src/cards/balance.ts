import {
  operationToText,
  Polynomial,
  polynomialToExpr,
  readEquation,
  readOperation,
  solveEquation,
  toPolynomial,
  toText,
  type Operation,
  type SolutionSet,
} from '../math'
import type { BalanceMode, BalanceWidget } from './types'

/**
 * Logic of the balance widget, without React: reading the widget data, the
 * pieces on both pans, applying a transformation to both sides or to one
 * side only, the frames of that change, texts for the lines below the figure
 * and for screen readers, and the geometry. Everything is derived from the
 * widget data, so it can be tested in Node.
 *
 * The picture: a box weighs x, a small weight 1. Negative terms are balloons
 * tied to the pan, pulling it up by x or by 1. A weight and a balloon of the
 * same kind on one pan cancel. The boxes have a real weight (the solution of
 * the equation), which decides how the balance tilts; the learner only sees
 * "x". Doing the same on both sides keeps the balance level, doing it on one
 * side only tips it.
 */

/** 0: left pan, 1: right pan. */
export type BalanceSide = 0 | 1

const SIDES = [0, 1] as const

/** Pieces on one pan. A canonical pan has no weight together with a balloon of the same kind. */
export interface Pan {
  /** Boxes weighing x each. */
  boxes: number
  /** Balloons lifting x each. */
  boxBalloons: number
  /** Weights of 1. */
  units: number
  /** Balloons lifting 1 each. */
  unitBalloons: number
}

export type Pans = readonly [Pan, Pan]

export type PieceKind = 'box' | 'box-balloon' | 'unit' | 'unit-balloon'

export const PIECE_KINDS = ['box', 'box-balloon', 'unit', 'unit-balloon'] as const satisfies readonly PieceKind[]

/** Most x pieces (boxes or balloons) on a pan once pairs have cancelled. */
export const BALANCE_MAX_BOXES = 6
/** Most unit pieces (weights or balloons) on a pan once pairs have cancelled. */
export const BALANCE_MAX_UNITS = 12
/** Largest divisor: more groups would be too narrow to draw. */
export const BALANCE_MAX_DIVISOR = 6
/** Most keys of the palette in explore mode. */
export const BALANCE_MAX_PALETTE = 8

/** Weight of a box if the equation has no or infinitely many solutions (any weight shows the same behaviour). */
const DEFAULT_BOX_WEIGHT = 3

/** What a transformation does to a pan. */
export type BalanceMove =
  /** Signed numbers of x pieces and unit pieces to add; negative numbers are balloons. */
  | { kind: 'add'; boxes: number; units: number }
  /** Split into `by` equal groups and keep one. */
  | { kind: 'divide'; by: number }
  /** Times −1: weights and balloons change roles. */
  | { kind: 'flip' }

export interface BalanceOperation {
  /** As read by the math core, e.g. for `operationToLatex`. */
  operation: Operation
  move: BalanceMove
  /** Sign and operand in input syntax, e.g. "- 2x" or ": 3". */
  text: string
}

export type BalanceTarget = 'both' | 'left' | 'right'

export interface BalanceModel {
  mode: BalanceMode
  variable: string
  /** The pans of the equation as given. */
  start: Pans
  solution: SolutionSet
  /** What a box really weighs; decides the tilt and is never shown. */
  boxWeight: number
  /** The given transformations (steps mode), each applied to both sides. */
  steps: readonly BalanceOperation[]
  /** The keys of the palette (explore mode). */
  palette: readonly BalanceOperation[]
}

// ---------------------------------------------------------------------------
// Reading and checking the widget data

/**
 * Problems of a balance widget (empty if it is fine); used by
 * `validateDeck`, so broken content fails the CI.
 */
export function balanceProblems(widget: BalanceWidget): string[] {
  return analyse(widget).problems.map((p) => `balance: ${p}`)
}

/** The model of a valid widget. @throws Error if the widget has problems (see `balanceProblems`). */
export function buildBalance(widget: BalanceWidget): BalanceModel {
  const { model, problems } = analyse(widget)
  if (!model) throw new Error(`Invalid balance: ${problems.join('; ')}`)
  return model
}

interface Linear {
  slope: number
  constant: number
}

/** `slope · variable + constant` with whole numbers, or null for anything else. */
function linearOf(poly: Polynomial, variable: string): Linear | null {
  let slope = 0
  let constant = 0
  for (const term of poly.terms()) {
    if (!term.coef.isInteger()) return null
    const [first, ...rest] = term.mono
    if (first === undefined) constant = term.coef.toNumber()
    else if (rest.length === 0 && first[0] === variable && first[1] === 1) slope = term.coef.toNumber()
    else return null
  }
  return { slope, constant }
}

function panOf({ slope, constant }: Linear): Pan {
  return {
    boxes: Math.max(slope, 0),
    boxBalloons: Math.max(-slope, 0),
    units: Math.max(constant, 0),
    unitBalloons: Math.max(-constant, 0),
  }
}

function fits(pan: Pan): boolean {
  return pan.boxes + pan.boxBalloons <= BALANCE_MAX_BOXES && pan.units + pan.unitBalloons <= BALANCE_MAX_UNITS
}

type ReadMove = { ok: true; operation: BalanceOperation } | { ok: false; problem: string }

function readMove(source: string, variable: string): ReadMove {
  const fail = (reason: string): ReadMove => ({ ok: false, problem: `operation "${source}" ${reason}` })
  const read = readOperation(source)
  if (!read.ok) return fail(`cannot be used (${read.error.code})`)
  const { operation } = read
  if (operation.kind === 'simplify' || operation.kind === 'swap') return fail('has no picture on the balance')
  const done = (move: BalanceMove): ReadMove => ({
    ok: true,
    operation: { operation, move, text: operationToText(operation).slice(2) },
  })
  const operand = toPolynomial(operation.operand)
  if (operation.kind === 'add' || operation.kind === 'subtract') {
    const linear = linearOf(operand, variable)
    if (!linear) return fail(`needs whole numbers and whole multiples of ${variable}`)
    if (linear.slope === 0 && linear.constant === 0) return fail('changes nothing')
    // Avoids -0, which is not equal to 0 in test comparisons.
    const signed = (n: number) => (operation.kind === 'add' || n === 0 ? n : -n)
    return done({ kind: 'add', boxes: signed(linear.slope), units: signed(linear.constant) })
  }
  const value = operand.constantValue()
  const n = value?.isInteger() === true ? value.toNumber() : null
  if (n === -1) return done({ kind: 'flip' })
  if (operation.kind === 'divide' && n !== null && n >= 2 && n <= BALANCE_MAX_DIVISOR) return done({ kind: 'divide', by: n })
  return fail(`is not supported: use ": 2" to ": ${BALANCE_MAX_DIVISOR}" or "· (-1)"`)
}

function defaultPalette(variable: string): string[] {
  return ['+ 1', '- 1', `+ ${variable}`, `- ${variable}`, ': 2', ': 3']
}

function analyse(widget: BalanceWidget): { model: BalanceModel | null; problems: string[] } {
  const stop = (problem: string) => ({ model: null, problems: [problem] })
  const read = readEquation(widget.equation)
  if (!read.ok) return stop(`equation "${widget.equation}" does not parse`)
  const variables = [...new Set([...read.left.variables(), ...read.right.variables()])]
  const [variable] = variables
  if (variable === undefined || variables.length !== 1) return stop('the equation needs exactly one variable')
  const left = linearOf(read.left, variable)
  const right = linearOf(read.right, variable)
  const solution = solveEquation(read.equation)
  if (!left || !right || !solution) return stop('both sides must be linear with whole numbers')
  const start: Pans = [panOf(left), panOf(right)]
  if (!start.every(fits)) {
    return stop(`the equation needs at most ${BALANCE_MAX_BOXES} x pieces and ${BALANCE_MAX_UNITS} unit pieces per side`)
  }
  // A box that should pull upwards (x < 0) or weighs a fraction would not look like what it is.
  if (solution.kind === 'single' && (!solution.value.isInteger() || solution.value.sign() < 0)) {
    return stop(`the solution ${solution.value.toString()} must be a whole number that is not negative`)
  }

  const problems: string[] = []
  const readAll = (sources: readonly string[]): BalanceOperation[] =>
    sources.flatMap((source) => {
      const result = readMove(source, variable)
      if (result.ok) return [result.operation]
      problems.push(result.problem)
      return []
    })

  const steps = widget.mode === 'steps' ? readAll(widget.steps ?? []) : []
  const palette = widget.mode === 'explore' ? readAll(widget.operations ?? defaultPalette(variable)) : []
  const model: BalanceModel = {
    mode: widget.mode,
    variable,
    start,
    solution,
    boxWeight: solution.kind === 'single' ? solution.value.toNumber() : DEFAULT_BOX_WEIGHT,
    steps,
    palette,
  }

  if (widget.mode === 'steps') {
    if (widget.operations !== undefined) problems.push('operations are only used in explore mode')
    if ((widget.steps ?? []).length === 0) problems.push('steps mode needs steps')
    if (problems.length === 0) {
      let pans = start
      for (const step of steps) {
        const result = applyMove(model, pans, step, 'both')
        if (!result.ok) {
          problems.push(`step "${step.text}" does not work on ${lineText(lineOf(model, pans))} (${result.code})`)
          break
        }
        pans = result.pans
      }
    }
  } else {
    if (widget.steps !== undefined) problems.push('steps are only used in steps mode')
    if (widget.operations?.length === 0) problems.push('explore mode needs operations')
    if (palette.length > BALANCE_MAX_PALETTE) problems.push(`explore mode has at most ${BALANCE_MAX_PALETTE} operations`)
  }
  return { model: problems.length === 0 ? model : null, problems }
}

// ---------------------------------------------------------------------------
// Weighing

export function pieceCount(pan: Pan, kind: PieceKind): number {
  switch (kind) {
    case 'box':
      return pan.boxes
    case 'box-balloon':
      return pan.boxBalloons
    case 'unit':
      return pan.units
    case 'unit-balloon':
      return pan.unitBalloons
  }
}

function panWeight(model: BalanceModel, pan: Pan): number {
  return (pan.boxes - pan.boxBalloons) * model.boxWeight + pan.units - pan.unitBalloons
}

/** The heavier side, or `balanced`. */
export type BalanceTilt = 'left' | 'balanced' | 'right'

export function balanceTilt(model: BalanceModel, pans: Pans): BalanceTilt {
  const difference = panWeight(model, pans[0]) - panWeight(model, pans[1])
  return difference > 0 ? 'left' : difference < 0 ? 'right' : 'balanced'
}

/**
 * The value of x that can be read off: the balance is level, one box lies
 * alone on one pan and the other pan has no x pieces. Otherwise null.
 */
export function balanceResult(model: BalanceModel, pans: Pans): number | null {
  if (balanceTilt(model, pans) !== 'balanced') return null
  for (const side of SIDES) {
    const own = pans[side]
    const other = pans[side === 0 ? 1 : 0]
    const alone = own.boxes === 1 && own.boxBalloons === 0 && own.units === 0 && own.unitBalloons === 0
    if (alone && other.boxes === 0 && other.boxBalloons === 0) return other.units - other.unitBalloons
  }
  return null
}

// ---------------------------------------------------------------------------
// Texts

/** Text as shown to learners: a real minus sign instead of the hyphen. */
export function balanceDisplay(text: string): string {
  return text.replace(/-/g, '−')
}

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

function joinList(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} und ${parts.at(-1) ?? ''}`
}

/** The pieces of a pan in words, e.g. "3 x-Kästchen und 2 Gewichte"; "nichts" for an empty pan. */
export function describePan(pan: Pan, variable: string): string {
  const parts = [
    pan.boxes > 0 ? `${pan.boxes} ${variable}-Kästchen` : '',
    pan.boxBalloons > 0 ? count(pan.boxBalloons, `${variable}-Ballon`, `${variable}-Ballons`) : '',
    pan.units > 0 ? count(pan.units, 'Gewicht', 'Gewichte') : '',
    pan.unitBalloons > 0 ? count(pan.unitBalloons, 'Ballon', 'Ballons') : '',
  ].filter(Boolean)
  return parts.length === 0 ? 'nichts' : joinList(parts)
}

const TILT_TEXT: Record<BalanceTilt, string> = {
  balanced: 'Die Waage ist im Gleichgewicht.',
  left: 'Die linke Seite ist schwerer.',
  right: 'Die rechte Seite ist schwerer.',
}

/** The whole figure in words; the accessible name of the drawing. */
export function describeBalance(model: BalanceModel, pans: Pans): string {
  const { variable } = model
  return `Waage. Links: ${describePan(pans[0], variable)}. Rechts: ${describePan(pans[1], variable)}. ${TILT_TEXT[balanceTilt(model, pans)]}`
}

/** One line below the figure: both pans as terms in input syntax, and whether the balance is level. */
export interface BalanceLine {
  left: string
  right: string
  balanced: boolean
  /** The transformation applied to this line, if any. */
  operation?: BalanceOperation
  target?: BalanceTarget
}

function panTerm(pan: Pan, variable: string): string {
  const poly = Polynomial.monomial(pan.boxes - pan.boxBalloons, { [variable]: 1 }).add(Polynomial.constant(pan.units - pan.unitBalloons))
  return poly.isZero() ? '0' : toText(polynomialToExpr(poly))
}

function lineOf(model: BalanceModel, pans: Pans): BalanceLine {
  return {
    left: panTerm(pans[0], model.variable),
    right: panTerm(pans[1], model.variable),
    balanced: balanceTilt(model, pans) === 'balanced',
  }
}

/** A line as text, e.g. "2x = 6", or with "≠" if the balance is not level. */
export function lineText(line: BalanceLine): string {
  return `${balanceDisplay(line.left)} ${line.balanced ? '=' : '≠'} ${balanceDisplay(line.right)}`
}

/** What the balance shows now, e.g. "Jetzt: x = 3. Das x-Kästchen liegt allein." */
export function nowText(model: BalanceModel, pans: Pans): string {
  const now = `Jetzt: ${lineText(lineOf(model, pans))}.`
  return balanceResult(model, pans) === null ? now : `${now} Das ${model.variable}-Kästchen liegt allein.`
}

const WHERE: Record<BalanceTarget, string> = { both: 'Auf beiden Seiten', left: 'Nur links', right: 'Nur rechts' }
const SIDE_NAMES = ['Links', 'Rechts'] as const
const WORDS: Record<'add' | 'subtract' | 'multiply' | 'divide', string> = {
  add: 'plus',
  subtract: 'minus',
  multiply: 'mal',
  divide: 'geteilt durch',
}

/** E.g. "Auf beiden Seiten minus 2x". */
function operationWords(operation: BalanceOperation, target: BalanceTarget): string {
  const { kind } = operation.operation
  const word = kind === 'simplify' || kind === 'swap' ? '' : WORDS[kind]
  // `text` starts with the sign and a space.
  return `${WHERE[target]} ${word} ${balanceDisplay(operation.text.slice(2))}`
}

function tiltChange(before: BalanceTilt, after: BalanceTilt): string {
  if (after === 'balanced') return before === 'balanced' ? 'Die Waage bleibt im Gleichgewicht.' : 'Die Waage ist wieder im Gleichgewicht.'
  const side = after === 'left' ? 'linke' : 'rechte'
  return before === after ? `Die ${side} Seite bleibt schwerer.` : `Die Waage kippt: Die ${side} Seite ist jetzt schwerer.`
}

// ---------------------------------------------------------------------------
// Transformations

/** Pairs of a weight and a balloon that cancel on one pan. */
export interface Pairs {
  boxes: number
  units: number
}

/**
 * One picture while a transformation happens. The last frame of a move is
 * the resting state; the frames before it show how it comes about.
 */
export interface BalanceFrame {
  pans: Pans
  /** Pairs that are about to cancel, per pan. */
  cancelling?: readonly [Pairs, Pairs]
  /** Number of equal groups each pan is split into (1: not split). */
  groups?: readonly [number, number]
  /** Only the first group stays; the others are about to go. */
  leaving?: boolean
  /** What happens, for the live region. */
  text: string
}

export type MoveResult =
  | {
      ok: true
      /** The pans afterwards (canonical). */
      pans: Pans
      frames: readonly BalanceFrame[]
      /** All frame texts in one; announced when the frames are skipped (reduced motion). */
      summary: string
    }
  | {
      ok: false
      code: 'not-divisible' | 'no-room'
      /** German hint for the learner. */
      message: string
    }

function addPieces(pan: Pan, boxes: number, units: number): Pan {
  return {
    boxes: pan.boxes + Math.max(boxes, 0),
    boxBalloons: pan.boxBalloons + Math.max(-boxes, 0),
    units: pan.units + Math.max(units, 0),
    unitBalloons: pan.unitBalloons + Math.max(-units, 0),
  }
}

function pairsOf(pan: Pan): Pairs {
  return { boxes: Math.min(pan.boxes, pan.boxBalloons), units: Math.min(pan.units, pan.unitBalloons) }
}

function withoutPairs(pan: Pan): Pan {
  const pairs = pairsOf(pan)
  return {
    boxes: pan.boxes - pairs.boxes,
    boxBalloons: pan.boxBalloons - pairs.boxes,
    units: pan.units - pairs.units,
    unitBalloons: pan.unitBalloons - pairs.units,
  }
}

function pairsText(pairs: Pairs, variable: string): string {
  const parts = [
    pairs.boxes > 0 ? `${pairs.boxes} ${variable}-Kästchen und ${count(pairs.boxes, `${variable}-Ballon`, `${variable}-Ballons`)}` : '',
    pairs.units > 0 ? `${count(pairs.units, 'Gewicht', 'Gewichte')} und ${count(pairs.units, 'Ballon', 'Ballons')}` : '',
  ].filter(Boolean)
  return parts.join(' sowie ')
}

function mapPans(pans: Pans, touched: (side: BalanceSide) => boolean, change: (pan: Pan) => Pan): Pans {
  return [touched(0) ? change(pans[0]) : pans[0], touched(1) ? change(pans[1]) : pans[1]]
}

/**
 * Applies a transformation to both pans or to one pan only. Returns the pans
 * afterwards and the frames that show the change, or the reason why it does
 * not work here (not divisible, no room on the pan).
 */
export function applyMove(model: BalanceModel, pans: Pans, operation: BalanceOperation, target: BalanceTarget): MoveResult {
  const { variable } = model
  const { move } = operation
  const touched = (side: BalanceSide) => target === 'both' || (target === 'left' ? side === 0 : side === 1)
  const words = operationWords(operation, target)
  const before = balanceTilt(model, pans)
  const closing = (after: Pans) => `${tiltChange(before, balanceTilt(model, after))} ${nowText(model, after)}`
  const finish = (after: Pans, frames: BalanceFrame[]): MoveResult => ({
    ok: true,
    pans: after,
    frames,
    summary: frames.map((f) => f.text).join(' '),
  })

  switch (move.kind) {
    case 'add': {
      const added = mapPans(pans, touched, (pan) => addPieces(pan, move.boxes, move.units))
      const after = mapPans(added, touched, withoutPairs)
      if (!after.every(fits)) {
        return { ok: false, code: 'no-room', message: 'Dafür ist auf der Waage kein Platz mehr.' }
      }
      const pieces = addPieces({ boxes: 0, boxBalloons: 0, units: 0, unitBalloons: 0 }, move.boxes, move.units)
      const total = Math.abs(move.boxes) + Math.abs(move.units)
      const each = target === 'both' ? 'je ' : ''
      const addText = `${words}: ${each}${describePan(pieces, variable)} ${total === 1 ? 'kommt' : 'kommen'} dazu.`
      const cancelling: readonly [Pairs, Pairs] = [pairsOf(added[0]), pairsOf(added[1])]
      const cancelText = SIDES.flatMap((side) => {
        const text = pairsText(cancelling[side], variable)
        return text === '' ? [] : [`${SIDE_NAMES[side]} heben sich ${text} auf.`]
      }).join(' ')
      if (cancelText === '') return finish(after, [{ pans: after, text: `${addText} ${closing(after)}` }])
      return finish(after, [
        { pans: added, text: addText },
        { pans: added, cancelling, text: cancelText },
        { pans: after, text: closing(after) },
      ])
    }
    case 'divide': {
      const n = move.by
      const divisible = SIDES.every((side) => !touched(side) || PIECE_KINDS.every((kind) => pieceCount(pans[side], kind) % n === 0))
      if (!divisible) {
        return {
          ok: false,
          code: 'not-divisible',
          message: `Durch ${n} lässt sich hier nicht teilen: Die Stücke gehen nicht in ${n} gleiche Gruppen auf.`,
        }
      }
      const after = mapPans(pans, touched, (pan) => ({
        boxes: pan.boxes / n,
        boxBalloons: pan.boxBalloons / n,
        units: pan.units / n,
        unitBalloons: pan.unitBalloons / n,
      }))
      const groups: readonly [number, number] = [touched(0) ? n : 1, touched(1) ? n : 1]
      return finish(after, [
        { pans, groups, text: `${words}: ${n} gleiche Gruppen.` },
        { pans, groups, leaving: true, text: 'Eine Gruppe bleibt, die anderen kommen weg.' },
        { pans: after, text: closing(after) },
      ])
    }
    case 'flip': {
      const after = mapPans(pans, touched, (pan) => ({
        boxes: pan.boxBalloons,
        boxBalloons: pan.boxes,
        units: pan.unitBalloons,
        unitBalloons: pan.units,
      }))
      return finish(after, [{ pans: after, text: `${words}: Gewichte und Ballons tauschen die Rollen. ${closing(after)}` }])
    }
  }
}

// ---------------------------------------------------------------------------
// State: the transformations done so far

export interface BalanceEntry {
  operation: BalanceOperation
  target: BalanceTarget
  /** The pans after the transformation. */
  pans: Pans
}

export interface BalanceState {
  entries: readonly BalanceEntry[]
}

export const INITIAL_BALANCE_STATE: BalanceState = { entries: [] }

export function currentPans(model: BalanceModel, state: BalanceState): Pans {
  return state.entries.at(-1)?.pans ?? model.start
}

export function pushEntry(state: BalanceState, entry: BalanceEntry): BalanceState {
  return { entries: [...state.entries, entry] }
}

export function undoEntry(state: BalanceState): BalanceState {
  return { entries: state.entries.slice(0, -1) }
}

export interface PlannedStep {
  entry: BalanceEntry
  frames: readonly BalanceFrame[]
  summary: string
}

/** The given steps that are still to do (steps mode), simulated from the current pans. */
export function remainingBalanceSteps(model: BalanceModel, state: BalanceState): PlannedStep[] {
  const plan: PlannedStep[] = []
  let pans = currentPans(model, state)
  for (const operation of model.steps.slice(state.entries.length)) {
    const result = applyMove(model, pans, operation, 'both')
    // Cannot happen for a valid widget: `balanceProblems` simulates all steps.
    if (!result.ok) break
    pans = result.pans
    plan.push({ entry: { operation, target: 'both', pans }, frames: result.frames, summary: result.summary })
  }
  return plan
}

/** The lines below the figure: the equation, then one line per transformation done. */
export function balanceLines(model: BalanceModel, state: BalanceState): BalanceLine[] {
  const lines: BalanceLine[] = []
  let pans = model.start
  for (const entry of state.entries) {
    lines.push({ ...lineOf(model, pans), operation: entry.operation, target: entry.target })
    pans = entry.pans
  }
  lines.push(lineOf(model, pans))
  return lines
}

/**
 * Every term the widget typesets, in input syntax: both sides of every line
 * it can show without the learner's choices. Content tests render them with
 * KaTeX in strict mode.
 */
export function balanceTerms(model: BalanceModel): string[] {
  const state: BalanceState = { entries: remainingBalanceSteps(model, INITIAL_BALANCE_STATE).map((step) => step.entry) }
  return balanceLines(model, state).flatMap((line) => [line.left, line.right])
}

// ---------------------------------------------------------------------------
// Geometry (viewBox units)

export const BALANCE_GEOMETRY = {
  view: { x: -30, y: -10, width: 420, height: 260 },
  /** Where the beam turns. */
  pivot: { x: 180, y: 60 },
  /** Half the length of the beam. */
  arm: 120,
  /** Length of the strings from the beam down to the plate. */
  drop: 120,
  panWidth: 156,
  /** Top of the base. */
  floor: 236,
  /** Angle of a tilted beam in degrees. */
  tilt: 7,
} as const

/** Sizes of the pieces: `size` of the square weights, half axes `rx`/`ry` of the balloons, `slot` width per piece in a row. */
export const PIECE_SIZE = {
  box: { size: 22, slot: 25 },
  unit: { size: 16, slot: 19 },
  'box-balloon': { rx: 11, ry: 13, slot: 25 },
  'unit-balloon': { rx: 8, ry: 10, slot: 19 },
} as const

const ROW_GAP = 3
/** Free string above the weights before the first balloon, and the least string length on an empty plate. */
const BALLOON_CLEARANCE = 12
const BALLOON_MIN_STRING = 28

export interface BalancePose {
  /** Rotation of the beam in degrees (clockwise, so positive if the right side is heavier). */
  angle: number
  /** The ends of the beam, where the pans hang. */
  ends: readonly [{ x: number; y: number }, { x: number; y: number }]
}

export function balancePose(tilt: BalanceTilt): BalancePose {
  const { pivot, arm } = BALANCE_GEOMETRY
  const angle = tilt === 'balanced' ? 0 : tilt === 'right' ? BALANCE_GEOMETRY.tilt : -BALANCE_GEOMETRY.tilt
  const radians = (angle * Math.PI) / 180
  const dx = arm * Math.cos(radians)
  const dy = arm * Math.sin(radians)
  return {
    angle,
    ends: [
      { x: pivot.x - dx, y: pivot.y - dy },
      { x: pivot.x + dx, y: pivot.y + dy },
    ],
  }
}

export interface PieceLayout {
  kind: PieceKind
  /** Position among the pieces of its kind on the pan. */
  index: number
  /** Centre of the piece, relative to the middle of the plate; y is negative above the plate. */
  x: number
  y: number
  /** The group the piece belongs to (0 if the pan is not split). */
  column: number
}

export interface PanColumn {
  /** Left edge, relative to the middle of the plate. */
  x: number
  width: number
  /** Height of its pieces above the plate. */
  height: number
}

export interface PanLayout {
  pieces: PieceLayout[]
  columns: PanColumn[]
}

/**
 * Places the pieces of a pan. Weights stand on the plate in rows (boxes
 * below, units above), balloons float above them. With `groups` > 1 the pan
 * is split into that many columns with the same pieces each.
 */
export function layoutPan(pan: Pan, groups = 1): PanLayout {
  const split = groups > 1 && PIECE_KINDS.every((kind) => pieceCount(pan, kind) % groups === 0) ? groups : 1
  const width = BALANCE_GEOMETRY.panWidth / split
  const pieces: PieceLayout[] = []
  const columns: PanColumn[] = []

  for (let column = 0; column < split; column++) {
    const left = -BALANCE_GEOMETRY.panWidth / 2 + column * width
    const centre = left + width / 2
    let top = 0

    const place = (kind: PieceKind, slot: number, height: number) => {
      const perColumn = pieceCount(pan, kind) / split
      const capacity = Math.max(1, Math.floor((width - 4) / slot))
      for (let done = 0; done < perColumn; done += capacity) {
        const inRow = Math.min(capacity, perColumn - done)
        for (let i = 0; i < inRow; i++) {
          pieces.push({
            kind,
            index: column * perColumn + done + i,
            x: centre + (i - (inRow - 1) / 2) * slot,
            y: -(top + height / 2),
            column,
          })
        }
        top += height + ROW_GAP
      }
    }

    place('box', PIECE_SIZE.box.slot, PIECE_SIZE.box.size)
    place('unit', PIECE_SIZE.unit.slot, PIECE_SIZE.unit.size)
    if (pan.boxBalloons + pan.unitBalloons > 0) top = Math.max(top + BALLOON_CLEARANCE, BALLOON_MIN_STRING)
    place('box-balloon', PIECE_SIZE['box-balloon'].slot, PIECE_SIZE['box-balloon'].ry * 2)
    place('unit-balloon', PIECE_SIZE['unit-balloon'].slot, PIECE_SIZE['unit-balloon'].ry * 2)
    columns.push({ x: left, width, height: top })
  }
  return { pieces, columns }
}

/**
 * Whether a piece is drawn as on its way out: part of a pair that cancels
 * (the last weights and the first balloons of a kind), or in a group that
 * does not stay.
 */
export function isPieceLeaving(piece: PieceLayout, pan: Pan, frame: Pick<BalanceFrame, 'leaving'>, pairs: Pairs | undefined): boolean {
  if (frame.leaving === true && piece.column > 0) return true
  if (!pairs) return false
  switch (piece.kind) {
    case 'box':
      return piece.index >= pan.boxes - pairs.boxes
    case 'box-balloon':
      return piece.index < pairs.boxes
    case 'unit':
      return piece.index >= pan.units - pairs.units
    case 'unit-balloon':
      return piece.index < pairs.units
  }
}
