import type { Outcome } from '../practice/session'

interface SkillPathProps {
  /** Number of tasks in the series. */
  total: number
  /** Results of the finished tasks, in order. */
  outcomes: readonly Outcome[]
  /** Index of the task being worked on; omit once the series is over. */
  current?: number
  /** Accessible name of the list. */
  label: string
}

const STATE_TEXT = { correct: 'richtig', wrong: 'falsch', current: 'aktuell', todo: 'offen' } as const
const STATE_GLYPH = { correct: '✓', wrong: '✗', current: '', todo: '' } as const

/**
 * The series as a path of nodes (one per task) instead of a progress bar.
 * The state is never shown by colour alone: finished nodes carry a glyph and
 * every node has a text for screen readers.
 */
export default function SkillPath({ total, outcomes, current, label }: SkillPathProps) {
  return (
    // Explicit role: Safari drops the list semantics of lists without list-style.
    <ol className="skill-path" role="list" aria-label={label}>
      {Array.from({ length: total }, (_, i) => {
        const state = outcomes[i] ?? (i === current ? 'current' : 'todo')
        return (
          <li key={i} className={`path-step path-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="path-node" aria-hidden="true">
              {STATE_GLYPH[state]}
            </span>
            <span className="visually-hidden">
              Aufgabe {i + 1}: {STATE_TEXT[state]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
