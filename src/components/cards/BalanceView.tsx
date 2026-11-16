import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  applyMove,
  BALANCE_GEOMETRY,
  balanceDisplay,
  balanceLines,
  balancePose,
  balanceResult,
  balanceTilt,
  buildBalance,
  currentPans,
  describeBalance,
  INITIAL_BALANCE_STATE,
  isPieceLeaving,
  layoutPan,
  nowText,
  PIECE_KINDS,
  PIECE_SIZE,
  pieceCount,
  pushEntry,
  remainingBalanceSteps,
  undoEntry,
  type BalanceEntry,
  type BalanceFrame,
  type BalanceLine,
  type BalanceMode,
  type BalanceModel,
  type BalanceOperation,
  type BalanceSide,
  type BalanceState,
  type BalanceTarget,
  type BalanceWidget,
  type Pairs,
  type Pan,
  type Pans,
  type PieceLayout,
} from '../../cards'
import { termToLatex } from '../../content'
import { operationToLatex } from '../../math'
import { animate, DURATION, ENTER, useSequencePlayer, type SequenceStep } from '../../motion'
import Tex from '../Tex'

/** Pause between two pictures of a transformation, and between two transformations while playing. */
const FRAME_PAUSE = 1100

const SIDES = [0, 1] as const

const HINT: Record<BalanceMode, string> = {
  steps: 'Nutze „Nächster Schritt“ und beobachte beide Seiten.',
  explore: 'Wähle, wo du umformst, und tippe dann auf eine Umformung. Ziel: Ein Kästchen liegt allein auf einer Seite.',
}

const TARGETS: readonly { value: BalanceTarget; label: string }[] = [
  { value: 'both', label: 'beide Seiten' },
  { value: 'left', label: 'nur links' },
  { value: 'right', label: 'nur rechts' },
]

function lineLatex(line: BalanceLine): string {
  return `${termToLatex(line.left)} ${line.balanced ? '=' : '\\neq'} ${termToLatex(line.right)}`
}

/** The visible note below the controls in explore mode. */
function statusText(model: BalanceModel, state: BalanceState, pans: Pans, notice: string | null): string | null {
  if (notice !== null) return notice
  const result = balanceResult(model, pans)
  if (result !== null) return `Geschafft: ${model.variable} = ${balanceDisplay(String(result))}.`
  if (balanceTilt(model, pans) === 'balanced') return null
  const last = state.entries.at(-1)
  if (last && last.target !== 'both') {
    return 'Die Waage ist aus dem Gleichgewicht: Du hast nur eine Seite verändert. Nimm den Schritt zurück oder forme die andere Seite genauso um.'
  }
  return 'Die Waage ist nicht im Gleichgewicht.'
}

interface PieceShapeProps {
  id: string
  piece: PieceLayout
  variable: string
  leaving: boolean
}

/** A weight (square) or a balloon (ellipse); pieces on their way out are dashed and struck through. */
function PieceShape({ id, piece, variable, leaving }: PieceShapeProps) {
  const { kind, x, y } = piece
  const className = `balance-piece is-${kind}${leaving ? ' is-leaving' : ''}`
  if (kind === 'box' || kind === 'unit') {
    const half = PIECE_SIZE[kind].size / 2
    return (
      <g data-piece={id} className={className}>
        <rect x={x - half} y={y - half} width={half * 2} height={half * 2} rx={3} />
        <text x={x} y={y} textAnchor="middle" dominantBaseline="central">
          {kind === 'box' ? variable : '1'}
        </text>
        {leaving && <line className="balance-strike" x1={x - half} y1={y + half} x2={x + half} y2={y - half} />}
      </g>
    )
  }
  const { rx, ry } = PIECE_SIZE[kind]
  return (
    <g data-piece={id} className={className}>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central">
        {kind === 'box-balloon' ? `−${variable}` : '−1'}
      </text>
      {leaving && <line className="balance-strike" x1={x - rx} y1={y + ry} x2={x + rx} y2={y - ry} />}
    </g>
  )
}

interface PanPiecesProps {
  side: BalanceSide
  pan: Pan
  variable: string
  /** Number of equal groups the pan is split into (1: not split). */
  groups: number
  /** Only the first group stays. */
  leaving: boolean
  /** Pairs that are about to cancel. */
  pairs: Pairs | undefined
}

/** The pieces of one pan, relative to the middle of its plate. */
function PanPieces({ side, pan, variable, groups, leaving, pairs }: PanPiecesProps) {
  const layout = layoutPan(pan, groups)
  return (
    <g className="balance-pieces">
      {groups > 1 &&
        layout.columns.map((column, i) => (
          <rect
            key={i}
            className={leaving && i > 0 ? 'balance-group is-leaving' : 'balance-group'}
            x={column.x + 2}
            y={-(column.height + 4)}
            width={column.width - 4}
            height={column.height + 4}
            rx={4}
          />
        ))}
      {/* Strings first, so the weights cover them. */}
      {layout.pieces.map(({ kind, index, x, y }) => {
        if (kind !== 'box-balloon' && kind !== 'unit-balloon') return null
        return <line key={`${kind}-${index}`} className="balance-string" x1={x} y1={y + PIECE_SIZE[kind].ry} x2={x} y2={0} />
      })}
      {layout.pieces.map((piece) => (
        <PieceShape
          key={`${piece.kind}-${piece.index}`}
          id={`${side}-${piece.kind}-${piece.index}`}
          piece={piece}
          variable={variable}
          leaving={isPieceLeaving(piece, pan, { leaving }, pairs)}
        />
      ))}
    </g>
  )
}

/**
 * Balance: a linear equation as a pair of scales with boxes (x), weights (1)
 * and balloons (−x, −1).
 *
 * - steps: "Nächster Schritt" applies the next given transformation to both
 *   sides; "Abspielen" runs all of them.
 * - explore: the learner chooses where to transform (both sides, left only,
 *   right only) and picks a transformation from the palette. One side only
 *   tips the balance; "Rückgängig" takes the last step back.
 *
 * A transformation is shown in a few pictures (pieces arrive, pairs cancel,
 * groups form), and the beam turns. With reduced motion the final state
 * appears at once and "Abspielen" becomes "Alle zeigen". Everything is done
 * with buttons and a radio group; the drawing has a full text description
 * and every step is announced in a live region.
 */
export default function BalanceView({ widget }: { widget: BalanceWidget }) {
  const model = useMemo(() => buildBalance(widget), [widget])
  const [state, setState] = useState<BalanceState>(INITIAL_BALANCE_STATE)
  // A picture on the way to the state above; null once the transformation has settled.
  const [frame, setFrame] = useState<BalanceFrame | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [target, setTarget] = useState<BalanceTarget>('both')
  // True while "Abspielen" runs (a single step also plays its pictures, but is not stopped with the button).
  const [auto, setAuto] = useState(false)
  const { play, stop, playing, reducedMotion } = useSequencePlayer()

  const radioName = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const lineRefs = useRef<(HTMLLIElement | null)[]>([])

  const settled = currentPans(model, state)
  const pans = frame?.pans ?? settled
  const lines = balanceLines(model, state)
  const previousPans = useRef(pans)
  const previousLines = useRef(lines.length)

  // Fade in pieces that were just added, never on the first render.
  useEffect(() => {
    const before = previousPans.current
    previousPans.current = pans
    if (before === pans) return
    for (const side of SIDES) {
      for (const kind of PIECE_KINDS) {
        for (let i = pieceCount(before[side], kind); i < pieceCount(pans[side], kind); i++) {
          const piece = svgRef.current?.querySelector(`[data-piece="${side}-${kind}-${i}"]`)
          void animate(piece, ENTER.fade, { duration: DURATION.medium, reducedMotion })
        }
      }
    }
  }, [pans, reducedMotion])

  useEffect(() => {
    for (let i = previousLines.current; i < lines.length; i++) {
      void animate(lineRefs.current[i], ENTER.fromBelow, { duration: DURATION.medium, reducedMotion })
    }
    previousLines.current = lines.length
  }, [lines.length, reducedMotion])

  const total = model.steps.length
  const done = state.entries.length
  const complete = done >= total

  /** Stops a running transformation; the balance then shows the settled state. */
  const halt = () => {
    stop()
    setFrame(null)
    setAuto(false)
  }

  /** The pictures of one transformation as a sequence; the first one records the transformation. */
  const framesOf = (entry: BalanceEntry, frames: readonly BalanceFrame[]): SequenceStep[] =>
    frames.map((picture, i) => ({
      run: () => {
        if (i === 0) setState((current) => pushEntry(current, entry))
        setFrame(i === frames.length - 1 ? null : picture)
        setAnnouncement(picture.text)
      },
      pause: FRAME_PAUSE,
    }))

  const perform = (operation: BalanceOperation, where: BalanceTarget) => {
    halt()
    const result = applyMove(model, settled, operation, where)
    if (!result.ok) {
      setNotice(result.message)
      setAnnouncement(result.message)
      return
    }
    setNotice(null)
    const entry: BalanceEntry = { operation, target: where, pans: result.pans }
    // Reduced motion: no pictures in between, just the final state.
    if (reducedMotion || result.frames.length === 1) {
      setState(pushEntry(state, entry))
      setAnnouncement(result.summary)
      return
    }
    void play(framesOf(entry, result.frames))
  }

  const reset = (text: string) => {
    halt()
    setNotice(null)
    setState(INITIAL_BALANCE_STATE)
    setAnnouncement(text)
  }

  const onStep = () => {
    const next = model.steps[done]
    if (next) perform(next, 'both')
    else reset('')
  }

  const onPlay = () => {
    if (playing && auto) {
      halt()
      return
    }
    halt()
    const from = complete ? INITIAL_BALANCE_STATE : state
    const plan = remainingBalanceSteps(model, from)
    const last = plan.at(-1)
    if (!last) return
    // Reduced motion: no playback over time, just the final state.
    if (reducedMotion) {
      setState({ entries: [...from.entries, ...plan.map((step) => step.entry)] })
      setAnnouncement(`Alle Schritte gezeigt. ${nowText(model, last.entry.pans)}`)
      return
    }
    if (complete) setState(INITIAL_BALANCE_STATE)
    setAuto(true)
    void play(plan.flatMap((step) => framesOf(step.entry, step.frames))).then((finished) => {
      if (finished) setAuto(false)
    })
  }

  const onUndo = () => {
    halt()
    setNotice(null)
    const before = undoEntry(state)
    setState(before)
    setAnnouncement(`Schritt zurückgenommen. ${nowText(model, currentPans(model, before))}`)
  }

  // ---- Drawing

  const { view, pivot, arm, drop, panWidth, floor } = BALANCE_GEOMETRY
  const pose = balancePose(balanceTilt(model, pans))
  const result = balanceResult(model, settled)
  const status = model.mode === 'explore' ? statusText(model, state, settled, notice) : null
  const caption = `${HINT[model.mode]} Ein Kästchen wiegt ${model.variable}, ein kleines Gewicht 1. Ballons ziehen nach oben: Sie stehen für −${model.variable} und −1.`

  const playLabel = playing && auto ? 'Anhalten' : reducedMotion ? 'Alle zeigen' : 'Abspielen'
  const nothingToPlay = reducedMotion && complete

  return (
    <figure className="widget balance">
      <svg
        ref={svgRef}
        className={reducedMotion ? 'balance-svg is-still' : 'balance-svg'}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        role="img"
        aria-label={describeBalance(model, pans)}
      >
        <rect className="balance-base" x={pivot.x - 50} y={floor} width={100} height={8} rx={4} />
        <line className="balance-post" x1={pivot.x} y1={pivot.y} x2={pivot.x} y2={floor} />
        {/* Beam and pans are moved with CSS transforms, so the tilt can be animated. */}
        <g className="balance-beam" style={{ transform: `translate(${pivot.x}px, ${pivot.y}px) rotate(${pose.angle}deg)` }}>
          <line x1={-arm} y1={0} x2={arm} y2={0} />
        </g>
        <circle className="balance-pivot" cx={pivot.x} cy={pivot.y} r={6} />
        {SIDES.map((side) => (
          <g
            key={side}
            className="balance-pan"
            data-side={side}
            style={{ transform: `translate(${pose.ends[side].x}px, ${pose.ends[side].y}px)` }}
          >
            <line className="balance-cord" x1={0} y1={0} x2={-(panWidth / 2 - 8)} y2={drop} />
            <line className="balance-cord" x1={0} y1={0} x2={panWidth / 2 - 8} y2={drop} />
            <rect className="balance-plate" x={-panWidth / 2} y={drop} width={panWidth} height={6} rx={3} />
            <g transform={`translate(0 ${drop})`}>
              <PanPieces
                side={side}
                pan={pans[side]}
                variable={model.variable}
                groups={frame?.groups?.[side] ?? 1}
                leaving={frame?.leaving === true}
                pairs={frame?.cancelling?.[side]}
              />
            </g>
          </g>
        ))}
      </svg>
      <figcaption className="balance-caption">{caption}</figcaption>

      <ol className="solution" aria-label={widget.label ?? 'Umformungen'}>
        {lines.map((line, i) => (
          <li
            key={i}
            ref={(el) => {
              lineRefs.current[i] = el
            }}
            className={result !== null && i === lines.length - 1 ? 'solution-step solution-result' : 'solution-step'}
          >
            <span className="solution-rel" aria-hidden="true" />
            <span className="solution-expr">
              <Tex latex={lineLatex(line)} />
            </span>
            {line.operation && (
              <span className="solution-note">
                <Tex latex={operationToLatex(line.operation.operation)} />
                {line.target === 'left' && ' (nur links)'}
                {line.target === 'right' && ' (nur rechts)'}
              </span>
            )}
          </li>
        ))}
      </ol>

      {model.mode === 'steps' ? (
        <div className="practice-actions">
          <button type="button" className="btn btn-secondary" onClick={onStep}>
            {complete ? 'Von vorn' : 'Nächster Schritt'}
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
      ) : (
        <>
          <fieldset className="balance-target">
            <legend>Wo umformen?</legend>
            {TARGETS.map((option) => (
              <label key={option.value} className="balance-target-option">
                <input
                  type="radio"
                  name={radioName}
                  value={option.value}
                  checked={target === option.value}
                  onChange={() => setTarget(option.value)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </fieldset>
          <div className="practice-actions" role="group" aria-label="Umformung">
            {model.palette.map((operation, i) => (
              <button key={i} type="button" className="btn btn-secondary balance-key" onClick={() => perform(operation, target)}>
                {balanceDisplay(operation.text)}
              </button>
            ))}
          </div>
          <div className="practice-actions">
            <button
              type="button"
              className="btn btn-secondary"
              aria-disabled={done === 0 || undefined}
              onClick={done === 0 ? undefined : onUndo}
            >
              Rückgängig
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              aria-disabled={done === 0 || undefined}
              onClick={done === 0 ? undefined : () => reset(`Von vorn. ${nowText(model, model.start)}`)}
            >
              Von vorn
            </button>
          </div>
          {status !== null && <p className="balance-status">{status}</p>}
        </>
      )}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </figure>
  )
}
