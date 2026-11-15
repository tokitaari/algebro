/**
 * Card decks: data model, state transitions, storage and validation.
 * No React here except `useDeck`; the components live in src/components/cards.
 */
export {
  answerChoice,
  answerTerm,
  canGoTo,
  canReveal,
  correctOption,
  initialDeckState,
  isCardDone,
  isDeckComplete,
  lastReachable,
  next,
  OPEN_QUESTION,
  previous,
  goTo,
  questionState,
  reveal,
  termQuestionKey,
  type DeckState,
  type QuestionFeedback,
  type QuestionState,
  type Resolution,
} from './deck'
export { CARDS_STORAGE_KEY, loadDeckState, restoreDeckState, saveDeckState, toStoredDeck, type StoredDeck } from './storage'
export type { Card, CardQuestion, CardWidget, ChoiceOption, ChoiceQuestion, Deck, TermQuestion, TermStep, TermStepsWidget } from './types'
export { useDeck } from './useDeck'
export { deckMarkup, validateDeck } from './validate'
