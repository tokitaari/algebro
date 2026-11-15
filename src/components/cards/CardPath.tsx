import type { Card } from '../../cards'

interface CardPathProps {
  cards: readonly Card[]
  current: number
  /** Last card that may be visited; later cards are locked. */
  reachable: number
  /** Whether each card is done (no question, or its question resolved), see `isCardDone`. */
  done: readonly boolean[]
  onSelect: (index: number) => void
}

const STATE_TEXT = { current: 'aktuell', done: 'erledigt', open: 'offen', locked: 'gesperrt' } as const
const STATE_GLYPH = { current: '', done: '✓', open: '', locked: '' } as const

/**
 * The cards of a deck as a path of nodes, like the skill path of a practice
 * series. Reached cards are buttons to jump to; locked cards are disabled.
 * The state is never shown by colour alone: done cards carry a glyph and
 * every node has a text for screen readers.
 */
export default function CardPath({ cards, current, reachable, done, onSelect }: CardPathProps) {
  return (
    // Explicit role: Safari drops the list semantics of lists without list-style.
    <ol className="card-path" role="list" aria-label="Karten">
      {cards.map((card, i) => {
        // Cards before the current one are always done; later ones only count as done once their question is solved.
        const state =
          i === current
            ? 'current'
            : i > reachable
              ? 'locked'
              : i < current || (done[i] && card.question)
                ? 'done'
                : 'open'
        return (
          <li key={card.id} className={`card-step card-${state}`}>
            <button
              type="button"
              className="card-node-button"
              disabled={state === 'locked'}
              aria-current={state === 'current' ? 'step' : undefined}
              onClick={() => onSelect(i)}
            >
              <span className="card-node" aria-hidden="true">
                {STATE_GLYPH[state]}
              </span>
              <span className="visually-hidden">
                Karte {i + 1}: {card.title} ({STATE_TEXT[state]})
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
