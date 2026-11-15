import type { Markup } from '../content/types'
import type { FormRequirement } from '../math'

/**
 * Explanations are decks of cards (similar to brilliant.org): one card at a
 * time, each with a short text, at most one interactive element and usually
 * one question that must be answered before moving on.
 *
 * Everything here is plain data, so decks can be checked in Node tests
 * (markup parses, claims are true, every question can be solved).
 */

export interface Card {
  /** Unique within its deck; stored progress refers to cards by id, so keep it stable when editing a deck. */
  id: string
  title: string
  /** Paragraphs. */
  body: Markup[]
  /** At most one interactive element, shown after the text. */
  widget?: CardWidget
  /** Question shown after the widget; "Weiter" stays locked until it is solved or the solution was revealed. */
  question?: CardQuestion
}

/**
 * Interactive elements. Each kind has its own component (see
 * src/components/cards/CardWidgetView.tsx); new kinds such as the area model
 * or the balance are added to this union.
 */
export type CardWidget = TermStepsWidget

/**
 * A transformation shown line by line: the start term, then `= term` per step
 * with an optional note. Every step must be equivalent to the start term.
 */
export interface TermStepsWidget {
  kind: 'term-steps'
  /** Start term in input syntax. */
  start: string
  steps: TermStep[]
  /** Accessible name of the list, e.g. "Lösungsweg". Default: "Umformung". */
  label?: string
}

export interface TermStep {
  /** Term in input syntax; multiplication dots in the source are kept when typeset. */
  term: string
  note?: Markup
}

export type CardQuestion = ChoiceQuestion | TermQuestion

/** Single choice: exactly one option is correct. */
export interface ChoiceQuestion {
  kind: 'choice'
  prompt: Markup
  options: ChoiceOption[]
  /** Shown once the question is solved or revealed. */
  explanation?: Markup
}

export interface ChoiceOption {
  text: Markup
  correct?: true
  /** Shown when this (wrong) option is picked, e.g. which mistake leads to it. */
  feedback?: Markup
}

/**
 * Free term input, checked with `checkAnswer` like in the practice area:
 * equivalence to `answer`, then the required form.
 */
export interface TermQuestion {
  kind: 'term'
  prompt: Markup
  /** Optional term shown large below the prompt, in input syntax. */
  term?: string
  /** Model answer in input syntax; it must pass its own check (tested). */
  answer: string
  form: FormRequirement
  /** Letters for the input keys; default: the letters of `answer`. */
  variables?: string[]
  explanation?: Markup
}

/** A deck of cards for one subtopic (or a demo). */
export interface Deck {
  /** Storage key of the deck, e.g. the TopicId "algebra/terme/ausmultiplizieren". */
  id: string
  cards: Card[]
}
