import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildEquationSteps,
  describeFrame,
  equationStepsRows,
  frameCount,
  stepsDone,
  stepTotal,
  type EquationStepsRow,
  type EquationStepsWidget,
} from '../../cards'
import { animate, DURATION, ENTER, useSequencePlayer } from '../../motion'
import RichText from '../RichText'
import Tex from '../Tex'

/** Pause between two frames while playing. */
const STEP_PAUSE = 1100

/** Markers of what is visible: every line, plus `key|op` once its operation is written next to it. */
function visibleMarkers(rows: readonly EquationStepsRow[]): string[] {
  return rows.flatMap((row) => (row.kind === 'equation' && row.operation ? [row.key, `${row.key}|op`] : [row.key]))
}

/**
 * A linear equation solved line by line (school notation). "Nächster Schritt"
 * shows one more frame: for `+`, `−`, `·` and `:` first the operation next to
 * the line and written onto both sides (highlighted), then the simplified
 * line in its place. "Abspielen" runs through all frames. With reduced motion
 * there is no playback: the second button shows everything at once, and
 * nothing moves.
 */
export default function EquationStepsView({ widget }: { widget: EquationStepsWidget }) {
  const model = useMemo(() => buildEquationSteps(widget), [widget])
  const total = frameCount(model)
  const [frame, setFrame] = useState(0)
  const { play, stop, playing, reducedMotion } = useSequencePlayer()
  const rowRefs = useRef(new Map<string, HTMLLIElement>())
  const previous = useRef<string[] | null>(null)

  // Animate only what was just added, never on the first render.
  useEffect(() => {
    const markers = visibleMarkers(equationStepsRows(model, frame))
    const before = previous.current
    previous.current = markers
    if (before === null) return
    for (const marker of markers) {
      if (before.includes(marker)) continue
      const [key, part] = marker.split('|')
      const row = rowRefs.current.get(key ?? '')
      if (!row) continue
      if (part === 'op') {
        void animate(row.querySelector('.equation-op'), ENTER.fade, { duration: DURATION.medium, reducedMotion })
        continue
      }
      void animate(row, ENTER.fromBelow, { duration: DURATION.medium, reducedMotion })
      row.querySelectorAll('.equation-operand').forEach((operand, i) => {
        void animate(operand, ENTER.fromRight, {
          duration: DURATION.long,
          delay: DURATION.medium + i * DURATION.short,
          reducedMotion,
        })
      })
    }
  }, [model, frame, reducedMotion])

  const rows = equationStepsRows(model, frame)
  const all = frame === total

  const onStep = () => {
    stop()
    setFrame(all ? 0 : frame + 1)
  }

  const onPlay = () => {
    if (playing) {
      stop()
      return
    }
    // Reduced motion: no playback over time, just the final state.
    if (reducedMotion) {
      setFrame(total)
      return
    }
    const from = all ? 0 : frame
    if (all) setFrame(0)
    void play(
      Array.from({ length: total - from }, (_, i) => ({
        run: () => setFrame(from + i + 1),
        pause: STEP_PAUSE,
      })),
    )
  }

  const playLabel = playing ? 'Anhalten' : reducedMotion ? 'Alle zeigen' : 'Abspielen'
  const nothingToPlay = reducedMotion && all

  return (
    <div className="widget equation-steps">
      <ol className="solution" aria-label={widget.label ?? 'Lösungsweg'}>
        {rows.map((row, i) => (
          <li
            key={row.key}
            ref={(el) => {
              if (el) rowRefs.current.set(row.key, el)
              else rowRefs.current.delete(row.key)
            }}
            className={rowClass(row, all && i === rows.length - 1)}
          >
            <RowContent row={row} />
          </li>
        ))}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {describeFrame(model, frame)}
      </p>
      <div className="practice-actions">
        <button type="button" className="btn btn-secondary" onClick={onStep}>
          {all ? 'Von vorn' : 'Nächster Schritt'}
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
          {stepsDone(model, frame)} von {stepTotal(model)} Schritten
        </span>
      </div>
    </div>
  )
}

function rowClass(row: EquationStepsRow, result: boolean): string {
  const classes = ['solution-step']
  if (row.kind === 'intermediate') classes.push('is-intermediate')
  if (result) classes.push('solution-result')
  return classes.join(' ')
}

function RowContent({ row }: { row: EquationStepsRow }) {
  switch (row.kind) {
    case 'equation':
      return (
        <>
          <span className="solution-rel" aria-hidden="true" />
          <span className="solution-expr">
            <Tex latex={row.latex} />
          </span>
          {row.operation && (
            <span className="solution-note equation-op">
              <Tex latex={row.operation} />
              {row.note && (
                <span className="equation-op-note">
                  <RichText text={row.note} />
                </span>
              )}
            </span>
          )}
        </>
      )
    case 'intermediate':
      return (
        <>
          <span className="solution-rel" aria-hidden="true" />
          <span className="solution-expr equation-line">
            <Tex latex={row.left.base} />
            <span className="equation-operand">
              <Tex latex={row.left.operand} />
            </span>
            <Tex latex="=" />
            <Tex latex={row.right.base} />
            <span className="equation-operand">
              <Tex latex={row.right.operand} />
            </span>
          </span>
        </>
      )
    case 'solution':
      return (
        <>
          <span className="solution-rel" aria-hidden="true" />
          <span className="solution-expr">
            <Tex latex={row.latex} />
          </span>
        </>
      )
  }
}
