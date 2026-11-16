import { useState } from 'react'
import type { TopicProgress } from '../practice/progress'

interface PracticeProgressProps {
  progress: TopicProgress
  /** True if the browser refused to store the progress. */
  saveFailed: boolean
  /** Called once the learner has confirmed that the progress of this subtopic is deleted. */
  onReset: () => void
}

/** Progress of a subtopic above the practice task, with the confirmed reset. Shared by all practice areas. */
export default function PracticeProgress({ progress, saveFailed, onReset }: PracticeProgressProps) {
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="practice-progress">
      <p>
        {progress.answered === 0
          ? 'Noch keine Aufgabe gelöst.'
          : `Bisher: ${progress.correct} von ${progress.answered} richtig.`}
        {progress.lastSeries &&
          ` Letzte Serie: ${progress.lastSeries.correct} von ${progress.lastSeries.total} richtig.`}
      </p>
      {saveFailed && (
        <p className="practice-warning" role="alert">
          Dein Browser erlaubt kein Speichern. Der Fortschritt geht beim Neuladen verloren.
        </p>
      )}
      {progress.answered > 0 &&
        (confirmReset ? (
          <p className="practice-confirm">
            Fortschritt in diesem Teilthema löschen und eine neue Serie beginnen?{' '}
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setConfirmReset(false)
                onReset()
              }}
            >
              Ja, zurücksetzen
            </button>{' '}
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
              Abbrechen
            </button>
          </p>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(true)}>
            Fortschritt zurücksetzen
          </button>
        ))}
    </div>
  )
}
