import { checkAnswer, parse, readTerm, toPolynomial, type AnswerKey, type Expr, type FormHint, type TermErrorInfo } from '../math'
import type { Card, TermQuestion } from './types'

/** How a question was finished: solved, or the learner looked at the solution. */
export type Resolution = 'correct' | 'revealed'

/** What the learner sees after "Prüfen" or "Lösung anzeigen". */
export type QuestionFeedback =
  | { kind: 'correct' }
  | { kind: 'revealed' }
  /** Choice: the picked option (index) is wrong; its `feedback` text, if any, is shown. */
  | { kind: 'wrong-choice'; option: number }
  /** Term: not equivalent. `answer` is the parsed input, shown typeset. */
  | { kind: 'wrong'; answer: Expr | null }
  /** Term: equivalent, but not in the requested form. */
  | { kind: 'wrong-form'; hint: FormHint }
  /** Term: unreadable input; `input` is the text the error position refers to. Does not count as a miss. */
  | { kind: 'invalid'; error: TermErrorInfo; input: string }

export interface QuestionState {
  resolved: Resolution | null
  /** Wrong answers so far (wrong option, non-equivalent term, wrong form). Unlocks "Lösung anzeigen". */
  misses: number
  /** Feedback of the last action; null after a reload (only the resolution is stored). */
  feedback: QuestionFeedback | null
}

/**
 * State of a deck: the visible card and the questions by card id. Pure data,
 * changed only by the functions below (like src/practice/session.ts).
 *
 * Rule: a card can be visited if every card before it is done (has no
 * question, or its question is resolved). So the reachable cards are always
 * a prefix of the deck, and nothing beyond the first open question is visible.
 */
export interface DeckState {
  index: number
  questions: Readonly<Record<string, QuestionState>>
}

export const OPEN_QUESTION: QuestionState = { resolved: null, misses: 0, feedback: null }

export function initialDeckState(): DeckState {
  return { index: 0, questions: {} }
}

export function questionState(state: DeckState, card: Card): QuestionState {
  return (Object.hasOwn(state.questions, card.id) ? state.questions[card.id] : undefined) ?? OPEN_QUESTION
}

export function isCardDone(state: DeckState, card: Card): boolean {
  return !card.question || questionState(state, card).resolved !== null
}

/** Index of the last card that may be shown: the first card that is not done, or the last card. */
export function lastReachable(cards: readonly Card[], state: DeckState): number {
  const open = cards.findIndex((card) => !isCardDone(state, card))
  return open === -1 ? Math.max(cards.length - 1, 0) : open
}

export function canGoTo(cards: readonly Card[], state: DeckState, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < cards.length && index <= lastReachable(cards, state)
}

export function goTo(cards: readonly Card[], state: DeckState, index: number): DeckState {
  return canGoTo(cards, state, index) && index !== state.index ? { ...state, index } : state
}

export function next(cards: readonly Card[], state: DeckState): DeckState {
  return goTo(cards, state, state.index + 1)
}

export function previous(cards: readonly Card[], state: DeckState): DeckState {
  return goTo(cards, state, state.index - 1)
}

/** True when every card is done; the deck then shows its closing actions on the last card. */
export function isDeckComplete(cards: readonly Card[], state: DeckState): boolean {
  return cards.every((card) => isCardDone(state, card))
}

/** The answer key of a term question, built from its model answer. */
export function termQuestionKey(question: TermQuestion): AnswerKey {
  return { expected: toPolynomial(parse(question.answer)), form: question.form }
}

function withQuestion(state: DeckState, card: Card, question: QuestionState): DeckState {
  return { ...state, questions: { ...state.questions, [card.id]: question } }
}

function resolve(state: DeckState, card: Card, current: QuestionState, resolution: Resolution): DeckState {
  const feedback: QuestionFeedback = resolution === 'correct' ? { kind: 'correct' } : { kind: 'revealed' }
  return withQuestion(state, card, { ...current, resolved: resolution, feedback })
}

function miss(state: DeckState, card: Card, current: QuestionState, feedback: QuestionFeedback): DeckState {
  return withQuestion(state, card, { ...current, misses: current.misses + 1, feedback })
}

/** Checks the picked option of a choice question. Resolved questions do not change. */
export function answerChoice(state: DeckState, card: Card, option: number): DeckState {
  const question = card.question
  const current = questionState(state, card)
  if (question?.kind !== 'choice' || current.resolved) return state
  const picked = question.options[option]
  if (!picked) return state
  return picked.correct ? resolve(state, card, current, 'correct') : miss(state, card, current, { kind: 'wrong-choice', option })
}

/**
 * Checks a term with `checkAnswer`. Unlike the practice area, a wrong answer
 * is not final: the learner may try again as often as they like.
 */
export function answerTerm(state: DeckState, card: Card, input: string): DeckState {
  const question = card.question
  const current = questionState(state, card)
  if (question?.kind !== 'term' || current.resolved) return state
  const result = checkAnswer(termQuestionKey(question), input)
  switch (result.kind) {
    case 'correct':
      return resolve(state, card, current, 'correct')
    case 'wrong': {
      const read = readTerm(input)
      return miss(state, card, current, { kind: 'wrong', answer: read.ok ? read.expr : null })
    }
    case 'wrong-form':
      return miss(state, card, current, { kind: 'wrong-form', hint: result.hint })
    case 'invalid':
      return withQuestion(state, card, { ...current, feedback: { kind: 'invalid', error: result.error, input } })
  }
}

/** "Lösung anzeigen" is offered after the first miss. */
export function canReveal(state: DeckState, card: Card): boolean {
  const current = questionState(state, card)
  return card.question !== undefined && current.resolved === null && current.misses > 0
}

export function reveal(state: DeckState, card: Card): DeckState {
  return canReveal(state, card) ? resolve(state, card, questionState(state, card), 'revealed') : state
}

/** Index of the correct option of a choice question (validated to exist exactly once). */
export function correctOption(options: readonly { correct?: true }[]): number {
  return options.findIndex((option) => option.correct === true)
}
