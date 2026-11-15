import { useEffect, useRef, useState } from 'react'
import type { TermStepsWidget } from '../../cards'
import { termToLatex } from '../../content'
import { animate, DURATION, ENTER, useSequencePlayer } from '../../motion'
import RichText from '../RichText'
import Tex from '../Tex'

/** Pause between two lines while playing. */
const STEP_PAUSE = 1100

/**
 * A transformation revealed line by line: the start term, then `= term` per
 * step. "Nächster Schritt" shows one more line, "Abspielen" shows them one
 * after another. With reduced motion there is no playback: the second button
 * shows all lines at once, and lines appear without animation.
 */
export default function TermStepsView({ widget }: { widget: TermStepsWidget }) {
  const total = widget.steps.length
  const [shown, setShown] = useState(0)
  const { play, stop, playing, reducedMotion } = useSequencePlayer()
  const items = useRef<(HTMLLIElement | null)[]>([])
  const previous = useRef(0)

  // Animate only lines that were just added, never on the first render.
  useEffect(() => {
    if (shown > previous.current) {
      void animate(items.current[shown - 1], ENTER.fromBelow, { duration: DURATION.medium, reducedMotion })
    }
    previous.current = shown
  }, [shown, reducedMotion])

  const all = shown === total

  const onStep = () => {
    stop()
    setShown(all ? 0 : shown + 1)
  }

  const onPlay = () => {
    if (playing) {
      stop()
      return
    }
    // Reduced motion: no playback over time, just the final state.
    if (reducedMotion) {
      setShown(total)
      return
    }
    const from = all ? 0 : shown
    if (all) setShown(0)
    void play(
      Array.from({ length: total - from }, (_, i) => ({
        run: () => setShown(from + i + 1),
        pause: STEP_PAUSE,
      })),
    )
  }

  const playLabel = playing ? 'Anhalten' : reducedMotion ? 'Alle zeigen' : 'Abspielen'
  const nothingToPlay = reducedMotion && all

  return (
    <div className="widget term-steps">
      {/* New lines are announced by screen readers as they appear. */}
      <ol className="solution" aria-label={widget.label ?? 'Umformung'} aria-live="polite">
        <li className="solution-step">
          <span className="solution-rel" aria-hidden="true" />
          <span className="solution-expr">
            <Tex latex={termToLatex(widget.start)} />
          </span>
        </li>
        {widget.steps.slice(0, shown).map((step, i) => (
          <li
            key={i}
            ref={(el) => {
              items.current[i] = el
            }}
            className={i === total - 1 ? 'solution-step solution-result' : 'solution-step'}
          >
            <span className="solution-rel">
              <Tex latex="=" />
            </span>
            <span className="solution-expr">
              <Tex latex={termToLatex(step.term)} />
            </span>
            {step.note && (
              <span className="solution-note">
                <RichText text={step.note} />
              </span>
            )}
          </li>
        ))}
      </ol>
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
          {shown} von {total} Schritten
        </span>
      </div>
    </div>
  )
}
