import type { RefObject } from 'react'
import { countCorrect, type SeriesState } from '../practice/session'
import SkillPath from './SkillPath'

interface SeriesSummaryProps {
  series: SeriesState
  /** Receives the focus once the series is over. */
  summaryRef: RefObject<HTMLHeadingElement | null>
  onRestart: () => void
}

/** Result of a finished series: score, one node per task and a button for the next series. */
export default function SeriesSummary({ series, summaryRef, onRestart }: SeriesSummaryProps) {
  const total = series.tasks.length
  return (
    <div className="practice-summary">
      <h3 ref={summaryRef} tabIndex={-1}>
        Serie geschafft: {countCorrect(series)} von {total} richtig
      </h3>
      <SkillPath total={total} outcomes={series.outcomes} label="Ergebnis je Aufgabe" />
      <button type="button" className="btn btn-primary" onClick={onRestart}>
        Neue Serie
      </button>
    </div>
  )
}
