import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  answerChoice,
  answerTerm,
  canReveal,
  goTo,
  isCardDone,
  isDeckComplete,
  lastReachable,
  questionState,
  reveal,
  useDeck,
  type Deck,
  type DeckState,
} from '../../cards'
import { animate, DURATION, ENTER, useReducedMotion } from '../../motion'
import RichText from '../RichText'
import CardPath from './CardPath'
import CardWidgetView from './CardWidgetView'
import ChoiceQuestionView from './ChoiceQuestionView'
import TermQuestionView from './TermQuestionView'

interface CardDeckProps {
  deck: Deck
  /** Shown below the last card once every card is done, e.g. a link to the practice area. */
  finish?: ReactNode
}

/** Where the focus goes after the next render; set by the handler that caused it. */
type PendingFocus = 'heading' | 'continue' | null

/** Elements whose own arrow-key behaviour must not be taken over by the deck. */
const KEEP_ARROWS = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])'

/**
 * A deck of explanation cards, one card at a time. "Weiter" stays locked
 * until the card's question is solved or its solution was revealed; reached
 * cards can be revisited via "Zurück" or the card path. ←/→ turn the card
 * when the focus is in the deck but not in a field. The state is stored in
 * the browser (see src/cards/storage.ts).
 *
 * Bind it to its deck with `key={deck.id}`.
 */
export default function CardDeck({ deck, finish }: CardDeckProps) {
  const { cards } = deck
  const { state, saveFailed, update, restart } = useDeck(deck)
  const reducedMotion = useReducedMotion()

  const counterId = useId()
  const titleId = useId()
  const lockId = useId()
  const cardRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)
  const doneRef = useRef<HTMLHeadingElement>(null)
  const pendingFocus = useRef<PendingFocus>(null)
  // Direction of the last card change, for the entry animation: 1 forward, -1 back, 0 none.
  const direction = useRef(0)
  // Bumped by "Von vorn beginnen", so widgets and questions start fresh even on the same card.
  const [round, setRound] = useState(0)

  const index = Math.min(state.index, Math.max(cards.length - 1, 0))
  const card = cards[index]
  const reachable = lastReachable(cards, state)
  const done = cards.map((c) => isCardDone(state, c))
  const complete = isDeckComplete(cards, state)
  const isLast = index === cards.length - 1

  useEffect(() => {
    const target = pendingFocus.current
    pendingFocus.current = null
    if (target === 'heading') {
      headingRef.current?.focus()
      const enter = direction.current >= 0 ? ENTER.fromRight : ENTER.fromLeft
      void animate(cardRef.current, enter, { duration: DURATION.medium, reducedMotion })
    } else if (target === 'continue') {
      const button = continueRef.current ?? doneRef.current
      button?.focus()
    }
  }, [state, reducedMotion])

  if (!card) return null

  const show = (target: number) => {
    const next = goTo(cards, state, target)
    if (next === state) return
    direction.current = Math.sign(target - state.index)
    pendingFocus.current = 'heading'
    update(next)
  }

  /** Applies a question transition; once the question is resolved, the focus moves on to "Weiter". */
  const answer = (next: DeckState) => {
    if (next === state) return
    if (questionState(next, card).resolved && !questionState(state, card).resolved) pendingFocus.current = 'continue'
    update(next)
  }

  const onRestart = () => {
    direction.current = -1
    pendingFocus.current = 'heading'
    setRound((r) => r + 1)
    restart()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (e.target instanceof Element && e.target.closest(KEEP_ARROWS)) return
    if (e.key === 'ArrowRight' && index + 1 <= reachable) {
      e.preventDefault()
      show(index + 1)
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      show(index - 1)
    }
  }

  const locked = !done[index]
  const question = card.question
  const q = questionState(state, card)

  return (
    // The deck only listens for arrow keys that bubble up from its own controls.
    <div className="deck" onKeyDown={onKeyDown}>
      <CardPath cards={cards} current={index} reachable={reachable} done={done} onSelect={show} />

      <article ref={cardRef} className="deck-card" aria-labelledby={titleId}>
        <p id={counterId} className="deck-counter">
          Karte {index + 1} von {cards.length}
        </p>
        <h3 id={titleId} ref={headingRef} tabIndex={-1} aria-describedby={counterId}>
          {card.title}
        </h3>
        {card.body.map((paragraph, i) => (
          <p key={i}>
            <RichText text={paragraph} />
          </p>
        ))}
        {/* Keyed by card: every card starts with a fresh widget and question. */}
        {card.widget && <CardWidgetView key={`w-${card.id}-${round}`} widget={card.widget} />}
        {question?.kind === 'choice' && (
          <ChoiceQuestionView
            key={`q-${card.id}-${round}`}
            question={question}
            state={q}
            canReveal={canReveal(state, card)}
            onAnswer={(option) => answer(answerChoice(state, card, option))}
            onReveal={() => answer(reveal(state, card))}
          />
        )}
        {question?.kind === 'term' && (
          <TermQuestionView
            key={`q-${card.id}-${round}`}
            question={question}
            state={q}
            canReveal={canReveal(state, card)}
            onAnswer={(input) => answer(answerTerm(state, card, input))}
            onReveal={() => answer(reveal(state, card))}
          />
        )}
      </article>

      <div className="deck-nav">
        <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => show(index - 1)}>
          Zurück
        </button>
        {!isLast && (
          <button
            ref={continueRef}
            type="button"
            className="btn btn-primary"
            // aria-disabled instead of disabled: the button stays focusable and explains why it is locked.
            aria-disabled={locked || undefined}
            aria-describedby={locked ? lockId : undefined}
            onClick={locked ? undefined : () => show(index + 1)}
          >
            Weiter
          </button>
        )}
      </div>
      {locked && !isLast && (
        <p id={lockId} className="deck-lock">
          Beantworte zuerst die Frage, dann geht es weiter.
        </p>
      )}

      {isLast && complete && (
        <div className="deck-done">
          <h3 ref={doneRef} tabIndex={-1}>
            Alle Karten geschafft
          </h3>
          {finish}
          <button type="button" className="btn btn-secondary" onClick={onRestart}>
            Von vorn beginnen
          </button>
        </div>
      )}

      {saveFailed && (
        <p className="practice-warning" role="alert">
          Dein Browser erlaubt kein Speichern. Beim Neuladen beginnen die Karten wieder von vorn.
        </p>
      )}
    </div>
  )
}
