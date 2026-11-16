import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import {
  applyAreaStep,
  areaFrame,
  areaHandles,
  areaLines,
  areaStepCount,
  buildAreaModel,
  cellFactors,
  clampLength,
  describeStep,
  displayTerm,
  evaluate,
  handlePosition,
  initialAreaValues,
  initialReveal,
  layoutAreaModel,
  nextAreaStep,
  numericCheck,
  remainingSteps,
  SIDE_LABELS,
  sideText,
  solveHandle,
  type AreaCell,
  type AreaHandle,
  type AreaModelMode,
  type AreaModelWidget,
  type AreaRevealState,
  type AreaSide,
  type AreaStep,
} from '../../cards'
import { chainToLatex, termToLatex } from '../../content'
import { animate, DURATION, ENTER, useSequencePlayer } from '../../motion'
import Tex from '../Tex'

/** Pause between two steps while playing. */
const STEP_PAUSE = 900

/** Smallest label area (viewBox units) for one line of text, and for two lines (term and value). */
const LABEL_MIN = { width: 24, height: 18, twoLines: 36 } as const

const HINT: Record<AreaModelMode, string> = {
  expand: 'Tippe auf eine Teilfläche oder nutze „Nächstes Produkt“.',
  factor: 'Tippe auf ein Fragezeichen an einer Seite oder nutze „Nächster Schritt“.',
  explore: 'Ziehe die Punkte an den Kanten oder nutze dort die Pfeiltasten.',
}

/** Edge names per side: [positive summands, cut-off strips]. */
const EDGE_NAMES = [
  ['linke Kante', 'rechte Kante'],
  ['obere Kante', 'untere Kante'],
] as const

const CELL_KIND = ['plus', 'minus', 'back'] as const

type Focus = { kind: 'cell'; index: number } | { kind: 'side'; side: AreaSide } | { kind: 'step' }

/** Enter or Space on an SVG button; prevents the default (scrolling) when it is one. */
function isActivation(e: KeyboardEvent<SVGGElement>): boolean {
  if (e.key !== 'Enter' && e.key !== ' ') return false
  e.preventDefault()
  return true
}

/**
 * A partial area (`[data-cell]`) or side (`[data-side]`) of the drawing. They
 * are looked up in effects instead of collecting refs while drawing.
 */
function partOf(svg: SVGSVGElement | null, selector: string): SVGGElement | null {
  return svg?.querySelector<SVGGElement>(selector) ?? null
}

function signed(n: number): string {
  return String(n).replace('-', '−')
}

/**
 * Area model: a product of two sums as a rectangle of partial products.
 *
 * - expand: tap a hidden partial area (or "Nächstes Produkt") to reveal its
 *   product; once all are shown, "Zusammenfassen" marks like terms.
 * - factor: the partial areas are given; tap a "?" on a side (or "Nächster
 *   Schritt") to reveal the factors.
 * - explore: drawn to scale; drag the handles on the edges or use the arrow
 *   keys on them (sliders) to change the lengths, with a numeric check.
 *
 * Negative summands are strips cut off at the end of their side (hatched);
 * where two strips cross, the corner comes back (dotted). Reveals fade in
 * unless reduced motion is requested; "Abspielen" then becomes "Alle zeigen".
 * Partial areas and sides are buttons, handles are sliders, and every step
 * is announced in a live region.
 */
export default function AreaModelView({ widget }: { widget: AreaModelWidget }) {
  const model = useMemo(() => buildAreaModel(widget), [widget])
  const frame = useMemo(() => areaFrame(model), [model])
  const handles = useMemo(() => areaHandles(model), [model])
  const total = useMemo(() => areaStepCount(model), [model])

  const [reveal, setReveal] = useState<AreaRevealState>(() => initialReveal(model))
  const [values, setValues] = useState<Record<string, number>>(() => initialAreaValues(model))
  const [announcement, setAnnouncement] = useState('')
  const { play, stop, playing, reducedMotion } = useSequencePlayer()

  const ids = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const lineRefs = useRef<(HTMLLIElement | null)[]>([])
  const stepRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<Focus | null>(null)
  const drag = useRef<{ pointerId: number } | null>(null)

  const lines = areaLines(model, reveal)
  const previousReveal = useRef(reveal)
  const previousLines = useRef(lines.length)

  // Fade in partial areas that were just revealed, never on the first render.
  useEffect(() => {
    const before = previousReveal.current
    reveal.cells.forEach((shown, i) => {
      if (shown && !before.cells[i]) {
        void animate(partOf(svgRef.current, `[data-cell="${i}"]`), ENTER.fade, { duration: DURATION.medium, reducedMotion })
      }
    })
    previousReveal.current = reveal
  }, [reveal, reducedMotion])

  useEffect(() => {
    for (let i = previousLines.current; i < lines.length; i++) {
      void animate(lineRefs.current[i], ENTER.fromBelow, { duration: DURATION.medium, reducedMotion })
    }
    previousLines.current = lines.length
  }, [lines.length, reducedMotion])

  // A revealed area or side stops being a button; the focus moves on to the next one.
  useEffect(() => {
    const target = pendingFocus.current
    pendingFocus.current = null
    if (target?.kind === 'cell') partOf(svgRef.current, `[data-cell="${target.index}"]`)?.focus()
    else if (target?.kind === 'side') partOf(svgRef.current, `[data-side="${target.side}"]`)?.focus()
    else if (target?.kind === 'step') stepRef.current?.focus()
  }, [reveal])

  const layout = layoutAreaModel(model, values)
  const k = frame.scale
  const height = layout.sides[0].total * k
  const width = layout.sides[1].total * k
  const next = nextAreaStep(model, reveal)
  const complete = next === null
  const done = total - remainingSteps(model, reveal).length
  const hasCut = model.cells.some((c) => c.negatives === 1)
  const hasBack = model.cells.some((c) => c.negatives === 2)

  const run = (step: AreaStep, from: AreaRevealState): AreaRevealState => {
    const after = applyAreaStep(from, step)
    setReveal(after)
    setAnnouncement(describeStep(model, step, after))
    return after
  }

  const onStep = () => {
    stop()
    if (!next) {
      setReveal(initialReveal(model))
      setAnnouncement('')
      return
    }
    run(next, reveal)
  }

  const onPlay = () => {
    if (playing) {
      stop()
      return
    }
    const start = complete ? initialReveal(model) : reveal
    const plan = remainingSteps(model, start)
    const last = plan.at(-1)
    if (!last) return
    // Reduced motion: no playback over time, just the final state.
    if (reducedMotion) {
      setReveal(last.after)
      setAnnouncement(`Alles aufgedeckt. Ergebnis: ${displayTerm(areaLines(model, last.after).at(-1) ?? '')}`)
      return
    }
    if (complete) setReveal(start)
    void play(
      plan.map(({ step, after }) => ({
        run: () => {
          setReveal(after)
          setAnnouncement(describeStep(model, step, after))
        },
        pause: STEP_PAUSE,
      })),
    )
  }

  const onCell = (index: number) => {
    if (reveal.cells[index] !== false) return
    stop()
    const after = run({ kind: 'cell', index }, reveal)
    const hidden = after.cells.indexOf(false)
    pendingFocus.current = hidden >= 0 ? { kind: 'cell', index: hidden } : { kind: 'step' }
  }

  const onSide = (side: AreaSide) => {
    if (reveal.sides[side]) return
    stop()
    const after = run({ kind: 'side', side }, reveal)
    const hidden = after.sides.indexOf(false)
    pendingFocus.current = hidden === 0 || hidden === 1 ? { kind: 'side', side: hidden } : { kind: 'step' }
  }

  // ---- Handles (explore)

  const setLength = (variable: string, raw: number) => {
    const value = clampLength(model, variable, raw)
    setValues((current) => (current[variable] === value ? current : { ...current, [variable]: value }))
  }

  /** Pointer position along the handle's side, in model units. */
  const pointerPosition = (e: PointerEvent<SVGGElement>, handle: AreaHandle): number | null => {
    const svg = svgRef.current
    if (!svg) return null
    const box = svg.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return null
    const { view } = frame
    const along =
      handle.side === 1
        ? view.x + ((e.clientX - box.left) / box.width) * view.width
        : view.y + ((e.clientY - box.top) / box.height) * view.height
    return along / k
  }

  const onHandleDown = (e: PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.focus()
    if (typeof el.setPointerCapture === 'function') el.setPointerCapture(e.pointerId)
    drag.current = { pointerId: e.pointerId }
  }

  const onHandleMove = (e: PointerEvent<SVGGElement>, handle: AreaHandle) => {
    if (drag.current?.pointerId !== e.pointerId) return
    const position = pointerPosition(e, handle)
    if (position === null || !Number.isFinite(position)) return
    setLength(handle.variable, solveHandle(model, values, handle, position))
  }

  const onHandleUp = (e: PointerEvent<SVGGElement>) => {
    if (drag.current?.pointerId === e.pointerId) drag.current = null
  }

  // Slider keys as usual (→/↑ larger, ←/↓ smaller); always handled here, so the deck does not turn the card.
  const onHandleKey = (e: KeyboardEvent<SVGGElement>, handle: AreaHandle) => {
    const current = values[handle.variable] ?? 0
    let target: number
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        target = current + 1
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        target = current - 1
        break
      case 'Home':
        target = -Infinity
        break
      case 'End':
        target = Infinity
        break
      default:
        return
    }
    e.preventDefault()
    setLength(handle.variable, target)
  }

  // ---- Drawing

  const cellLabel = (cell: AreaCell, shown: boolean): string => {
    if (model.mode === 'factor') return `Teilfläche ${displayTerm(cell.text)}`
    if (!shown) return `Teilfläche ${cellFactors(model, cell)} aufdecken`
    const product = `${cellFactors(model, cell)} gleich ${displayTerm(cell.text)}`
    return model.mode === 'explore' ? `${product}, Wert ${signed(evaluate(cell.poly, values))}` : product
  }

  // Strips are drawn over the areas they cut, and corners over the strips.
  const drawOrder = [...model.cells].sort((a, b) => a.negatives - b.negatives)

  const cells = drawOrder.map((cell) => {
    const geometry = layout.cells[cell.index]
    if (!geometry) return null
    const { rect, label } = geometry
    const shown = reveal.cells[cell.index] === true
    const interactive = model.mode === 'expand' && !shown
    // Like terms are marked once combined; factor mode starts from the combined sum, so nothing is marked there.
    const group = model.mode !== 'factor' && reveal.combined && cell.group !== null ? model.groups[cell.group] : undefined
    const lx = label.x * k
    const ly = label.y * k
    const lw = label.width * k
    const lh = label.height * k
    const fits = lw >= LABEL_MIN.width && lh >= LABEL_MIN.height
    const withValue = shown && model.mode === 'explore' && lh >= LABEL_MIN.twoLines
    const className = [
      'area-cell',
      shown ? `is-${CELL_KIND[cell.negatives]}` : 'is-hidden',
      !shown && cell.negatives > 0 ? 'is-cut' : '',
      group && cell.group !== null ? `is-like area-like-${cell.group % 4}` : '',
    ]
      .filter(Boolean)
      .join(' ')
    const pattern = shown && cell.negatives === 1 ? `url(#${ids}-hatch)` : shown && cell.negatives === 2 ? `url(#${ids}-dots)` : undefined
    return (
      <g
        key={cell.index}
        data-cell={cell.index}
        className={className}
        role={interactive ? 'button' : 'img'}
        tabIndex={interactive ? 0 : undefined}
        aria-label={cellLabel(cell, shown)}
        onClick={interactive ? () => onCell(cell.index) : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (isActivation(e)) onCell(cell.index)
              }
            : undefined
        }
      >
        <rect x={rect.x * k} y={rect.y * k} width={rect.width * k} height={rect.height * k} fill={pattern} />
        {fits && (
          <text
            className="area-term"
            x={lx + lw / 2}
            y={ly + lh / 2 + (withValue ? -9 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {shown ? displayTerm(cell.text) : '?'}
          </text>
        )}
        {fits && withValue && (
          <text className="area-value" x={lx + lw / 2} y={ly + lh / 2 + 10} textAnchor="middle" dominantBaseline="central">
            {signed(evaluate(cell.poly, values))}
          </text>
        )}
        {fits && group && (
          <text className="area-mark" x={lx + 9} y={ly + 11} textAnchor="middle" dominantBaseline="central">
            {group.symbol}
          </text>
        )}
      </g>
    )
  })

  const sideGroup = (side: AreaSide): ReactNode => {
    const shown = reveal.sides[side]
    const interactive = model.mode === 'factor' && !shown
    const parts = layout.sides[side].parts
    const hasCutHere = model.sides[side].some((s) => s.negative)
    const items = parts.map((part, i) => {
      const summand = model.sides[side][i]
      if (!summand) return null
      const mid = ((part.span.start + part.span.end) / 2) * k
      const from = part.span.start * k
      const to = part.span.end * k
      const text = shown ? displayTerm(summand.text) : '?'
      if (side === 1) {
        const edge = summand.negative ? height : 0
        const out = summand.negative ? 6 : -6
        return (
          <g key={i}>
            <line className="area-tick" x1={from} y1={edge} x2={from} y2={edge + out} />
            <line className="area-tick" x1={to} y1={edge} x2={to} y2={edge + out} />
            <text className="area-side-label" x={mid} y={summand.negative ? height + 20 : -18} textAnchor="middle" dominantBaseline="central">
              {text}
            </text>
          </g>
        )
      }
      const edge = summand.negative ? width : 0
      const out = summand.negative ? 6 : -6
      return (
        <g key={i}>
          <line className="area-tick" x1={edge} y1={from} x2={edge + out} y2={from} />
          <line className="area-tick" x1={edge} y1={to} x2={edge + out} y2={to} />
          <text
            className="area-side-label"
            x={summand.negative ? width + 12 : -12}
            y={mid}
            textAnchor={summand.negative ? 'start' : 'end'}
            dominantBaseline="central"
          >
            {text}
          </text>
        </g>
      )
    })
    // Invisible hit areas along the label tracks, so the whole side is easy to tap.
    const hits =
      side === 1
        ? [
            <rect key="near" className="area-hit" x={0} y={-30} width={width} height={28} />,
            hasCutHere && <rect key="far" className="area-hit" x={0} y={height + 4} width={width} height={28} />,
          ]
        : [
            <rect key="near" className="area-hit" x={-46} y={0} width={44} height={height} />,
            hasCutHere && <rect key="far" className="area-hit" x={width + 2} y={0} width={44} height={height} />,
          ]
    return (
      <g
        key={`side-${side}`}
        data-side={side}
        className="area-side"
        role={interactive ? 'button' : 'img'}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? `${SIDE_LABELS[side]} aufdecken` : `${SIDE_LABELS[side]}: ${sideText(model, side)}`}
        onClick={interactive ? () => onSide(side) : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (isActivation(e)) onSide(side)
              }
            : undefined
        }
      >
        {interactive && hits}
        {items}
      </g>
    )
  }

  const handleItems = handles.map((handle, i) => {
    const pos = handlePosition(layout, handle) * k
    const [cx, cy] = handle.side === 1 ? [pos, handle.negative ? height : 0] : [handle.negative ? width : 0, pos]
    const [min, max] = [model.lengths?.[handle.variable]?.min, model.lengths?.[handle.variable]?.max]
    const value = values[handle.variable] ?? 0
    return (
      <g
        key={i}
        className="area-handle"
        role="slider"
        tabIndex={0}
        aria-label={`Länge ${handle.variable}, ${EDGE_NAMES[handle.side][handle.negative ? 1 : 0]}`}
        aria-orientation={handle.side === 1 ? 'horizontal' : 'vertical'}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${handle.variable} = ${value}`}
        transform={`translate(${cx} ${cy})`}
        onPointerDown={onHandleDown}
        onPointerMove={(e) => onHandleMove(e, handle)}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        onLostPointerCapture={onHandleUp}
        onKeyDown={(e) => onHandleKey(e, handle)}
      >
        <circle className="area-handle-hit" r={20} />
        <circle className="area-handle-ring" r={12} />
        <circle className="area-handle-dot" r={7} />
      </g>
    )
  })

  const keptHeight = layout.sides[0].kept * k
  const keptWidth = layout.sides[1].kept * k
  const { view } = frame
  // In factor mode the figure must not give the factors away.
  const figureName = `Flächenmodell für ${displayTerm(model.mode === 'factor' ? model.combined : model.product)}`
  const caption = [
    HINT[model.mode],
    model.lengths ? '' : 'Skizze, nicht maßstabsgetreu.',
    hasCut ? 'Schraffierte Streifen werden abgezogen.' : '',
    hasBack ? 'Die gepunktete Ecke wurde zweimal abgezogen und kommt einmal wieder dazu.' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const check = model.mode === 'explore' ? numericCheck(model, values) : null
  const valuesLatex = Object.keys(values)
    .sort()
    .map((name) => `${name} = ${values[name] ?? 0}`)
    .join(',\\; ')

  const stepLabel =
    next?.kind === 'cell' ? 'Nächstes Produkt' : next?.kind === 'side' ? 'Nächster Schritt' : next?.kind === 'combine' ? 'Zusammenfassen' : 'Von vorn'
  const playLabel = playing ? 'Anhalten' : reducedMotion ? 'Alle zeigen' : 'Abspielen'
  const nothingToPlay = reducedMotion && complete

  return (
    <figure className="widget area-model">
      <svg
        ref={svgRef}
        className="area-svg"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        role="group"
        aria-label={figureName}
      >
        <defs>
          <pattern id={`${ids}-hatch`} width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect className="area-hatch-bg" width={10} height={10} />
            <line className="area-hatch-line" x1={0} y1={0} x2={0} y2={10} />
          </pattern>
          {/* The corner counts positive again: opaque, in the colours of the positive areas. */}
          <pattern id={`${ids}-dots`} width={10} height={10} patternUnits="userSpaceOnUse">
            <rect className="area-dots-bg" width={10} height={10} />
            <circle className="area-dot" cx={5} cy={5} r={1.6} />
          </pattern>
        </defs>
        <rect className="area-outer" x={0} y={0} width={width} height={height} aria-hidden="true" />
        {cells}
        <rect className="area-kept" x={0} y={0} width={keptWidth} height={keptHeight} aria-hidden="true" />
        {sideGroup(0)}
        {sideGroup(1)}
        {handleItems}
      </svg>
      <figcaption className="area-caption">{caption}</figcaption>

      {check && (
        <div className="area-check">
          <p>
            <Tex latex={valuesLatex} />
          </p>
          <p>
            Rechteck: <Tex latex={chainToLatex(check.product)} />
          </p>
          <p>
            Teilflächen: <Tex latex={chainToLatex(check.cells)} />
          </p>
        </div>
      )}

      <ol className="solution" aria-label={widget.label ?? 'Rechnung'}>
        {lines.map((line, i) => (
          <li
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            className={i > 0 && i === lines.length - 1 && complete ? 'solution-step solution-result' : 'solution-step'}
          >
            <span className="solution-rel" aria-hidden={i === 0 || undefined}>
              {i > 0 && <Tex latex="=" />}
            </span>
            <span className="solution-expr">
              <Tex latex={termToLatex(line)} />
            </span>
          </li>
        ))}
      </ol>

      {reveal.combined && model.groups.length > 0 && model.mode !== 'factor' && (
        <ul className="area-groups" aria-label="Gleichartige Terme">
          {model.groups.map((group, i) => (
            <li key={i}>
              <span className={`area-group-mark area-like-${i % 4}`} aria-hidden="true">
                {group.symbol}
              </span>{' '}
              <Tex latex={chainToLatex(`${group.terms} = ${group.result}`)} />
              {group.cancels && ' – heben sich auf'}
            </li>
          ))}
        </ul>
      )}

      {model.mode !== 'explore' && (
        <div className="practice-actions">
          <button ref={stepRef} type="button" className="btn btn-secondary" onClick={onStep}>
            {stepLabel}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            aria-disabled={nothingToPlay || undefined}
            onClick={nothingToPlay ? undefined : onPlay}
          >
            {playLabel}
          </button>
          <span className="term-steps-count">
            {done} von {total} Schritten
          </span>
        </div>
      )}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </figure>
  )
}
