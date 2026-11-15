import { parse, Polynomial, polynomialToExpr, toPolynomial, toText } from '../math'
import type { AreaLength, AreaModelMode, AreaModelWidget } from './types'

/**
 * Logic of the area model widget, without React: summands, partial areas,
 * like terms, the lines of the calculation, the geometry and the state of
 * the step-by-step reveal. Everything is derived from the widget data, so it
 * can be tested in Node.
 *
 * Geometry in model units: the first factor runs down the left edge (rows),
 * the second along the top edge (columns), origin top left. Positive summands
 * are laid out from the origin; negative summands are strips cut off from
 * the end of their side, stacked inwards. The partial areas then overlap
 * where strips cross, and their signed sum is the kept rectangle
 * (inclusion–exclusion), e.g. (a−b)² = a² − ab − ab + b².
 */

/** 0: first factor (left edge, one row per summand); 1: second factor (top edge, one column per summand). */
export type AreaSide = 0 | 1

export const AREA_MAX_SUMMANDS = 3

/** Largest side of the drawing in viewBox units. */
export const AREA_DRAW = 280

/** Markers of like-term groups; shapes differ, so the grouping never depends on colour alone. */
const LIKE_SYMBOLS = ['●', '■', '▲', '◆'] as const

const SIDE_NAMES = ['first', 'second'] as const

/** Names of the sides in the interface, e.g. for announcements. */
export const SIDE_LABELS = ['Linke Seite', 'Obere Seite'] as const

/** Share of a sketched side taken by its negative summands (not to scale anyway). */
const SKETCH_CUT = 0.4

export interface Summand {
  /** Canonical input syntax, e.g. "-5" or "2x". */
  text: string
  poly: Polynomial
  negative: boolean
  /** Signed integer coefficient. */
  coef: number
  /** The variable of `c·v`; null for a number; undefined for anything else (e.g. `x²`, `ab`), which cannot be drawn to scale. */
  variable: string | null | undefined
  /** Monomial without coefficient, e.g. "x^1"; equal keys mean like terms. */
  key: string
}

export interface AreaCell {
  /** Row-major position: row · columns + column. */
  index: number
  row: number
  col: number
  poly: Polynomial
  /** The product in input syntax, e.g. "-5x". */
  text: string
  /** Number of negative factors: 1 is a strip that is taken away, 2 a corner that comes back. */
  negatives: 0 | 1 | 2
  /** Index into `groups` if the cell has like terms, else null. */
  group: number | null
}

/** Partial areas with like terms, combined in the last step. */
export interface LikeGroup {
  symbol: string
  cells: number[]
  /** Their sum before combining, e.g. "3x + 3x". */
  terms: string
  /** Combined, e.g. "6x"; "0" if they cancel. */
  result: string
  cancels: boolean
}

export interface AreaModel {
  mode: AreaModelMode
  sides: readonly [readonly Summand[], readonly Summand[]]
  cells: readonly AreaCell[]
  groups: readonly LikeGroup[]
  /** Both factors are equal; the product is written as a power. */
  square: boolean
  /** The product, e.g. "(x + 3)(x - 5)" or "(x + 3)^2". */
  product: string
  /** Sum of all partial areas in row-major order, e.g. "x² - 5x + 3x - 15". */
  expanded: string
  /** Like terms combined, e.g. "x² - 2x - 15". */
  combined: string
  /** Lengths if drawn to scale, else null (sketch). */
  lengths: Readonly<Record<string, AreaLength>> | null
}

// ---------------------------------------------------------------------------
// Reading and checking the widget data

/**
 * Problems of an area-model widget (empty if it is fine); used by
 * `validateDeck`, so broken content fails the CI.
 */
export function areaModelProblems(widget: AreaModelWidget): string[] {
  return analyse(widget).problems.map((p) => `area-model: ${p}`)
}

/** The model of a valid widget. @throws Error if the widget has problems (see `areaModelProblems`). */
export function buildAreaModel(widget: AreaModelWidget): AreaModel {
  const { model, problems } = analyse(widget)
  if (!model) throw new Error(`Invalid area model: ${problems.join('; ')}`)
  return model
}

function analyse(widget: AreaModelWidget): { model: AreaModel | null; problems: string[] } {
  const first = readSide(widget.first, 0)
  const second = readSide(widget.second, 1)
  const problems = [...first.problems, ...second.problems]
  if (problems.length > 0) return { model: null, problems }
  const model = assemble(widget, first.summands, second.summands)
  problems.push(...lengthProblems(model, widget))
  return { model: problems.length === 0 ? model : null, problems }
}

function readSummand(source: string): Summand | string {
  let poly: Polynomial
  try {
    poly = toPolynomial(parse(source))
  } catch {
    return `summand "${source}" does not parse`
  }
  const terms = poly.terms()
  const [term] = terms
  if (!term) return `summand "${source}" must not be zero`
  if (terms.length > 1) return `summand "${source}" must be a single term`
  if (!term.coef.isInteger()) return `summand "${source}" needs an integer coefficient`
  const [only, ...rest] = term.mono
  const variable = only === undefined ? null : rest.length === 0 && only[1] === 1 ? only[0] : undefined
  return {
    text: toText(polynomialToExpr(poly)),
    poly,
    negative: term.coef.sign() < 0,
    coef: term.coef.toNumber(),
    variable,
    key: monomialKey(poly),
  }
}

function readSide(sources: readonly string[], side: AreaSide): { summands: Summand[]; problems: string[] } {
  const name = SIDE_NAMES[side]
  if (sources.length < 1 || sources.length > AREA_MAX_SUMMANDS) {
    return { summands: [], problems: [`${name} side needs 1 to ${AREA_MAX_SUMMANDS} summands`] }
  }
  const summands: Summand[] = []
  const problems: string[] = []
  for (const source of sources) {
    const read = readSummand(source)
    if (typeof read === 'string') problems.push(read)
    else summands.push(read)
  }
  if (problems.length > 0) return { summands, problems }
  if (summands.every((s) => s.negative)) problems.push(`${name} side needs a positive summand`)
  summands.forEach((s, i) => {
    const like = summands.slice(0, i).find((other) => other.key === s.key)
    if (like) problems.push(`${name} side has like terms "${like.text}" and "${s.text}"`)
  })
  return { summands, problems }
}

function lengthProblems(model: AreaModel, widget: AreaModelWidget): string[] {
  const lengths = widget.lengths
  if (!lengths) return widget.mode === 'explore' ? ['explore needs lengths'] : []
  const problems: string[] = []
  const summands = [...model.sides[0], ...model.sides[1]]
  for (const s of summands) {
    if (s.variable === undefined) problems.push(`summand "${s.text}" cannot be drawn to scale`)
  }
  const used = new Set(summands.flatMap((s) => (typeof s.variable === 'string' ? [s.variable] : [])))
  for (const name of [...used].sort()) {
    if (!Object.hasOwn(lengths, name)) problems.push(`no length for "${name}"`)
  }
  for (const [name, length] of Object.entries(lengths).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (!used.has(name)) problems.push(`length for "${name}" is not used`)
    else if (!isValidLength(length, widget.mode === 'explore')) {
      problems.push(
        widget.mode === 'explore'
          ? `length of "${name}" needs integers with 1 ≤ min ≤ value ≤ max`
          : `length of "${name}" needs an integer value ≥ 1`,
      )
    }
  }
  if (problems.length > 0) return problems
  model.sides.forEach((side, i) => {
    if (worstKept(model, side) <= 0) problems.push(`${SIDE_NAMES[i] ?? 'a'} side must stay longer than its cut-off strips for every length`)
  })
  return problems
}

function isValidLength({ value, min, max }: AreaLength, explore: boolean): boolean {
  if (![value, min, max].every((n) => n === undefined || Number.isInteger(n))) return false
  if (explore) return min !== undefined && max !== undefined && min >= 1 && min <= value && value <= max
  return value >= 1 && (min ?? value) <= value && value <= (max ?? value)
}

/** Kept length of a side in the worst case: positive parts as short, cut-off strips as long as allowed. */
function worstKept(model: AreaModel, side: readonly Summand[]): number {
  const values: Record<string, number> = {}
  for (const s of side) {
    if (typeof s.variable !== 'string') continue
    const [min, max] = lengthRange(model, s.variable)
    values[s.variable] = s.negative ? max : min
  }
  return layoutSideToScale(side, values).kept
}

/** Range of a variable: the drag range in `explore`, otherwise just the given value. */
export function lengthRange(model: AreaModel, variable: string): [min: number, max: number] {
  const length = model.lengths?.[variable]
  if (!length) return [0, 0]
  return model.mode === 'explore' ? [length.min ?? length.value, length.max ?? length.value] : [length.value, length.value]
}

/** Rounds a dragged value to an integer within the range of the variable. */
export function clampLength(model: AreaModel, variable: string, raw: number): number {
  const [min, max] = lengthRange(model, variable)
  return Math.min(max, Math.max(min, Math.round(raw)))
}

export function initialAreaValues(model: AreaModel): Record<string, number> {
  return Object.fromEntries(Object.entries(model.lengths ?? {}).map(([name, length]) => [name, length.value]))
}

// ---------------------------------------------------------------------------
// Cells, like terms and the lines of the calculation

function assemble(widget: AreaModelWidget, first: Summand[], second: Summand[]): AreaModel {
  const cells: AreaCell[] = []
  first.forEach((a, row) => {
    second.forEach((b, col) => {
      const poly = a.poly.mul(b.poly)
      const negatives = ((a.negative ? 1 : 0) + (b.negative ? 1 : 0)) as 0 | 1 | 2
      cells.push({ index: cells.length, row, col, poly, text: termText(poly), negatives, group: null })
    })
  })

  const byKey = new Map<string, AreaCell[]>()
  for (const cell of cells) {
    const key = monomialKey(cell.poly)
    byKey.set(key, [...(byKey.get(key) ?? []), cell])
  }
  const groups: LikeGroup[] = []
  for (const members of byKey.values()) {
    if (members.length < 2) continue
    const sum = members.reduce((acc, c) => acc.add(c.poly), Polynomial.zero())
    for (const c of members) c.group = groups.length
    groups.push({
      symbol: LIKE_SYMBOLS[groups.length % LIKE_SYMBOLS.length] ?? '●',
      cells: members.map((c) => c.index),
      terms: joinTerms(members.map((c) => c.text)),
      result: termText(sum),
      cancels: sum.isZero(),
    })
  }

  const total = cells.reduce((acc, c) => acc.add(c.poly), Polynomial.zero())
  const square = first.length === second.length && first.every((s, i) => second[i]?.poly.equals(s.poly) === true)
  return {
    mode: widget.mode,
    sides: [first, second],
    cells,
    groups,
    square,
    product: productText(
      first.map((s) => s.text),
      second.map((s) => s.text),
      square,
    ),
    expanded: joinTerms(cells.map((c) => c.text)),
    combined: termText(total),
    lengths: widget.lengths ?? null,
  }
}

function termText(poly: Polynomial): string {
  return poly.isZero() ? '0' : toText(polynomialToExpr(poly))
}

function monomialKey(poly: Polynomial): string {
  return poly.terms()[0]?.mono.map(([name, e]) => `${name}^${e}`).join('*') ?? ''
}

/** Sum in input syntax from single terms, e.g. ["x²", "-5x"] → "x² - 5x". */
export function joinTerms(terms: readonly string[]): string {
  return terms.map((t, i) => (i === 0 ? t : t.startsWith('-') ? ` - ${t.slice(1)}` : ` + ${t}`)).join('')
}

/** A factor of the product: brackets unless it is a single positive summand (or a letter/number as a base). */
function factorText(terms: readonly string[], base: boolean): string {
  const [only] = terms
  const bare = terms.length === 1 && only !== undefined && !only.startsWith('-') && (!base || /^([a-z]|\d+)$/.test(only))
  const sum = joinTerms(terms)
  return bare ? sum : `(${sum})`
}

/** The product of two sums in input syntax; a number after a factor needs an explicit dot. */
function productText(first: readonly string[], second: readonly string[], square: boolean): string {
  if (square) return `${factorText(first, true)}^2`
  const a = factorText(first, false)
  const b = factorText(second, false)
  return /^\d/.test(b) ? `${a}·${b}` : `${a}${b}`
}

/** Display text with a real minus sign and a superscript square, e.g. "(x − 3)²". */
export function displayTerm(text: string): string {
  return text.replace(/\^2/g, '²').replace(/-/g, '−')
}

function factorDisplay(s: Summand | undefined): string {
  if (!s) return ''
  return s.negative ? `(${displayTerm(s.text)})` : displayTerm(s.text)
}

/** The two factors of a partial area in words, e.g. "x mal (−5)". */
export function cellFactors(model: AreaModel, cell: AreaCell): string {
  return `${factorDisplay(model.sides[0][cell.row])} mal ${factorDisplay(model.sides[1][cell.col])}`
}

/** A side as a sum, e.g. "x − 5". */
export function sideText(model: AreaModel, side: AreaSide): string {
  return displayTerm(joinTerms(model.sides[side].map((s) => s.text)))
}

/** Terms the widget typesets below the figure; content tests render all of them. */
export function areaModelTerms(model: AreaModel): string[] {
  return [model.product, model.expanded, model.combined, ...model.groups.flatMap((g) => [g.terms, g.result])]
}

// ---------------------------------------------------------------------------
// Geometry

export interface Interval {
  start: number
  end: number
}

export interface SidePart {
  /** Positive summand: its segment from the origin. Negative summand: the strip cut off at the end. */
  span: Interval
  /** The part of the span not cut off (positive summands) or the strip itself; null if fully cut off. Labels go here. */
  visible: Interval | null
}

export interface SideLayout {
  /** Length of all positive summands. */
  total: number
  /** Length left after cutting off the strips: the side of the product. */
  kept: number
  /** One part per summand, in the order of the summands. */
  parts: SidePart[]
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface AreaLayout {
  sides: readonly [SideLayout, SideLayout]
  /** Per cell (same order as `model.cells`): the whole partial area and where its label fits. */
  cells: { rect: Rect; label: Rect }[]
}

function layoutFromLengths(summands: readonly Summand[], lengths: readonly number[]): SideLayout {
  const total = summands.reduce((sum, s, i) => (s.negative ? sum : sum + (lengths[i] ?? 0)), 0)
  let pos = 0
  let cut = total
  const spans = summands.map((s, i): Interval => {
    const length = lengths[i] ?? 0
    if (s.negative) {
      cut -= length
      return { start: cut, end: cut + length }
    }
    pos += length
    return { start: pos - length, end: pos }
  })
  const kept = cut
  return {
    total,
    kept,
    parts: spans.map((span, i) => ({ span, visible: summands[i]?.negative ? span : clip(span, kept) })),
  }
}

function clip(span: Interval, kept: number): Interval | null {
  return span.start >= kept ? null : { start: span.start, end: Math.min(span.end, kept) }
}

function scaledLength(s: Summand, values: Readonly<Record<string, number>>): number {
  const factor = typeof s.variable === 'string' ? (values[s.variable] ?? 0) : 1
  return Math.abs(s.coef) * factor
}

function layoutSideToScale(summands: readonly Summand[], values: Readonly<Record<string, number>>): SideLayout {
  return layoutFromLengths(
    summands,
    summands.map((s) => scaledLength(s, values)),
  )
}

/** Sketch: terms with a variable are twice as long as numbers; the strips share a fixed part of the side. */
function layoutSideSketch(summands: readonly Summand[]): SideLayout {
  const positive = summands.reduce((sum, s) => (s.negative ? sum : sum + (s.variable === null ? 1 : 2)), 0)
  const negatives = summands.filter((s) => s.negative).length
  return layoutFromLengths(
    summands,
    summands.map((s) => (s.negative ? (positive * SKETCH_CUT) / negatives : s.variable === null ? 1 : 2)),
  )
}

function rectOf(rows: Interval, cols: Interval): Rect {
  return { x: cols.start, y: rows.start, width: cols.end - cols.start, height: rows.end - rows.start }
}

const NO_PART: SidePart = { span: { start: 0, end: 0 }, visible: null }

/** Geometry for the current lengths (ignored for a sketch). */
export function layoutAreaModel(model: AreaModel, values: Readonly<Record<string, number>>): AreaLayout {
  const side = (s: AreaSide) =>
    model.lengths ? layoutSideToScale(model.sides[s], values) : layoutSideSketch(model.sides[s])
  const rows = side(0)
  const cols = side(1)
  return {
    sides: [rows, cols],
    cells: model.cells.map((cell) => {
      const r = rows.parts[cell.row] ?? NO_PART
      const c = cols.parts[cell.col] ?? NO_PART
      return { rect: rectOf(r.span, c.span), label: rectOf(r.visible ?? r.span, c.visible ?? c.span) }
    }),
  }
}

/** Largest extent of each side over all allowed lengths: [rows (height), columns (width)]. */
export function maxExtents(model: AreaModel): [rows: number, cols: number] {
  const values: Record<string, number> = {}
  for (const name of Object.keys(model.lengths ?? {})) values[name] = lengthRange(model, name)[1]
  const layout = layoutAreaModel(model, values)
  return [layout.sides[0].total, layout.sides[1].total]
}

export interface AreaFrame {
  /** ViewBox units per model unit; fixed, so the figure does not jump while dragging. */
  scale: number
  view: { x: number; y: number; width: number; height: number }
}

/** Margins around the rectangle for side labels and handles. */
const MARGIN = { left: 48, top: 32, cut: 48, end: 16 } as const

/** Scale and viewBox of the drawing, large enough for the longest allowed sides. */
export function areaFrame(model: AreaModel): AreaFrame {
  const [rows, cols] = maxExtents(model)
  const scale = AREA_DRAW / Math.max(rows, cols, Number.EPSILON)
  const right = model.sides[0].some((s) => s.negative) ? MARGIN.cut : MARGIN.end
  const bottom = model.sides[1].some((s) => s.negative) ? MARGIN.top : MARGIN.end
  return {
    scale,
    view: {
      x: -MARGIN.left,
      y: -MARGIN.top,
      width: MARGIN.left + cols * scale + right,
      height: MARGIN.top + rows * scale + bottom,
    },
  }
}

// ---------------------------------------------------------------------------
// Handles (explore)

/**
 * A draggable edge: the end of a positive segment (top or left edge) or the
 * inner edge of a cut-off strip (bottom or right edge). A variable that
 * occurs on both sides has a handle on each; both change the same value.
 */
export interface AreaHandle {
  side: AreaSide
  /** Index of the summand on its side. */
  part: number
  variable: string
  negative: boolean
}

export function areaHandles(model: AreaModel): AreaHandle[] {
  if (model.mode !== 'explore') return []
  return ([0, 1] as const).flatMap((side) =>
    model.sides[side].flatMap((s, part): AreaHandle[] =>
      typeof s.variable === 'string' ? [{ side, part, variable: s.variable, negative: s.negative }] : [],
    ),
  )
}

/** Position of a handle along its side, in model units. */
export function handlePosition(layout: AreaLayout, handle: AreaHandle): number {
  const part = layout.sides[handle.side].parts[handle.part]
  if (!part) return 0
  return handle.negative ? part.span.start : part.span.end
}

/**
 * The (unrounded) value of the handle's variable that puts the handle at
 * `position`. The position depends linearly on the value, so it is solved
 * exactly; clamp the result with `clampLength`.
 */
export function solveHandle(
  model: AreaModel,
  values: Readonly<Record<string, number>>,
  handle: AreaHandle,
  position: number,
): number {
  const at = (v: number) => handlePosition(layoutAreaModel(model, { ...values, [handle.variable]: v }), handle)
  const base = at(0)
  const slope = at(1) - base
  return slope === 0 ? (values[handle.variable] ?? 0) : (position - base) / slope
}

export function evaluate(poly: Polynomial, values: Readonly<Record<string, number>>): number {
  return poly
    .terms()
    .reduce((sum, t) => sum + t.coef.toNumber() * t.mono.reduce((p, [name, e]) => p * (values[name] ?? 0) ** e, 1), 0)
}

export interface NumericCheck {
  /** Term chain in input syntax, e.g. "(6 - 2)^2 = 4^2 = 16". */
  product: string
  /** Signed partial areas, e.g. "36 - 12 - 12 + 4 = 16". */
  cells: string
  area: number
}

/** The product and the partial areas with the current numbers, for the check below the figure. */
export function numericCheck(model: AreaModel, values: Readonly<Record<string, number>>): NumericCheck {
  const sideValues = (side: AreaSide) => model.sides[side].map((s) => evaluate(s.poly, values))
  const rows = sideValues(0)
  const cols = sideValues(1)
  const rowSum = rows.reduce((a, b) => a + b, 0)
  const colSum = cols.reduce((a, b) => a + b, 0)
  const area = rowSum * colSum
  const pieces = [productText(rows.map(String), cols.map(String), model.square)]
  if (rows.length > 1 || cols.length > 1) pieces.push(model.square ? `${rowSum}^2` : `${rowSum}·${colSum}`)
  pieces.push(String(area))
  return {
    product: pieces.join(' = '),
    cells: `${joinTerms(model.cells.map((c) => String(evaluate(c.poly, values))))} = ${area}`,
    area,
  }
}

// ---------------------------------------------------------------------------
// Step-by-step reveal

export interface AreaRevealState {
  cells: readonly boolean[]
  sides: readonly [boolean, boolean]
  combined: boolean
}

export type AreaStep = { kind: 'cell'; index: number } | { kind: 'side'; side: AreaSide } | { kind: 'combine' }

export function initialReveal(model: AreaModel): AreaRevealState {
  const cells = (shown: boolean) => model.cells.map(() => shown)
  switch (model.mode) {
    case 'expand':
      return { cells: cells(false), sides: [true, true], combined: false }
    case 'factor':
      return { cells: cells(true), sides: [false, false], combined: true }
    case 'explore':
      return { cells: cells(true), sides: [true, true], combined: true }
  }
}

/** The next step in the default order (cells row by row, left side, top side, combining), or null when done. */
export function nextAreaStep(model: AreaModel, state: AreaRevealState): AreaStep | null {
  const hidden = state.cells.indexOf(false)
  if (hidden >= 0) return { kind: 'cell', index: hidden }
  if (!state.sides[0]) return { kind: 'side', side: 0 }
  if (!state.sides[1]) return { kind: 'side', side: 1 }
  if (model.groups.length > 0 && !state.combined) return { kind: 'combine' }
  return null
}

/** Applies a step; returns the same state if it changes nothing (combining waits for all cells). */
export function applyAreaStep(state: AreaRevealState, step: AreaStep): AreaRevealState {
  switch (step.kind) {
    case 'cell':
      if (state.cells[step.index] !== false) return state
      return { ...state, cells: state.cells.map((shown, i) => shown || i === step.index) }
    case 'side':
      if (state.sides[step.side]) return state
      return { ...state, sides: step.side === 0 ? [true, state.sides[1]] : [state.sides[0], true] }
    case 'combine':
      if (state.combined || state.cells.includes(false)) return state
      return { ...state, combined: true }
  }
}

/** The remaining steps in default order, each with the state after it. */
export function remainingSteps(model: AreaModel, state: AreaRevealState): { step: AreaStep; after: AreaRevealState }[] {
  const out: { step: AreaStep; after: AreaRevealState }[] = []
  let current = state
  for (let step = nextAreaStep(model, current); step; step = nextAreaStep(model, current)) {
    current = applyAreaStep(current, step)
    out.push({ step, after: current })
  }
  return out
}

export function areaStepCount(model: AreaModel): number {
  return remainingSteps(model, initialReveal(model)).length
}

/**
 * Lines of the calculation below the figure, in input syntax; every line
 * after the first is shown with "=".
 * - expand: product, then the sum of all partial areas, then the combined sum.
 * - factor: the given sum (and its split into partial areas), then the product.
 * - explore: all lines.
 */
export function areaLines(model: AreaModel, state: AreaRevealState): string[] {
  const combine = model.groups.length > 0
  switch (model.mode) {
    case 'expand': {
      const lines = [model.product]
      if (!state.cells.includes(false)) lines.push(model.expanded)
      if (combine && state.combined) lines.push(model.combined)
      return lines
    }
    case 'factor': {
      const lines = [model.combined]
      if (combine) lines.push(model.expanded)
      if (state.sides[0] && state.sides[1]) lines.push(model.product)
      return lines
    }
    case 'explore':
      return combine ? [model.product, model.expanded, model.combined] : [model.product, model.expanded]
  }
}

/** Text for screen readers after a step, e.g. "x mal (−5) gleich −5x". */
export function describeStep(model: AreaModel, step: AreaStep, after: AreaRevealState): string {
  switch (step.kind) {
    case 'cell': {
      const cell = model.cells[step.index]
      return cell ? `${cellFactors(model, cell)} gleich ${displayTerm(cell.text)}` : ''
    }
    case 'side': {
      const text = `${SIDE_LABELS[step.side]}: ${sideText(model, step.side)}`
      return after.sides[0] && after.sides[1] ? `${text}. Produkt: ${displayTerm(model.product)}` : text
    }
    case 'combine':
      return `Zusammengefasst: ${displayTerm(model.combined)}`
  }
}
