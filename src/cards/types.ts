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
 * src/components/cards/CardWidgetView.tsx); new kinds are added to this union.
 */
export type CardWidget = TermStepsWidget | AreaModelWidget | BalanceWidget

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

/**
 * Area model: the product of two sums drawn as a rectangle whose sides are
 * split into the summands; every partial area is one product. A negative
 * summand is drawn as a strip cut off from the end of its side, so e.g.
 * `(a-b)^2` shows the square `a^2` minus two strips `ab` plus the corner
 * `b^2` that was cut off twice. Logic and checks: src/cards/areaModel.ts.
 */
export interface AreaModelWidget {
  kind: 'area-model'
  /** Summands of the first factor along the left edge (one row each), input syntax, e.g. `['x', '3']`. */
  first: string[]
  /** Summands of the second factor along the top edge (one column each), e.g. `['x', '-5']`. */
  second: string[]
  /**
   * - `expand`: the partial areas start empty and are revealed one by one, then like terms are combined.
   * - `factor`: the partial areas are given, the sides start as "?" and are revealed (factoring backwards).
   * - `explore`: drawn to scale; the learner drags the variable lengths and sees a numeric check.
   */
  mode: AreaModelMode
  /**
   * Lengths of the variables. Without lengths the model is a sketch (not to
   * scale); with lengths it is drawn to scale, which needs summands like `3`
   * or `2x`. Required for `explore`, where `min` and `max` set the drag range.
   */
  lengths?: Record<string, AreaLength>
  /** Accessible name of the calculation below the figure. Default: "Rechnung". */
  label?: string
}

export type AreaModelMode = 'expand' | 'factor' | 'explore'

/** Integer length of a variable; `min`/`max` are needed for `explore` only. */
export interface AreaLength {
  value: number
  min?: number
  max?: number
}

/**
 * Balance: a linear equation as a pair of scales. A box weighs x, a small
 * weight 1; negative terms are balloons that pull their pan up. Doing the
 * same on both sides keeps the balance level, doing it on one side only tips
 * it; dividing splits both pans into equal groups and keeps one. Logic and
 * checks: src/cards/balance.ts.
 */
export interface BalanceWidget {
  kind: 'balance'
  /**
   * The equation in input syntax, e.g. `3x + 2 = x + 8`: linear in one
   * variable with whole numbers, at most 6 x pieces and 12 unit pieces per
   * side. If it has exactly one solution, that must be a whole number ≥ 0
   * (it is the weight of a box). Equations without or with infinitely many
   * solutions work too: the balance then never or always is level.
   */
  equation: string
  /**
   * - `steps`: the given transformations are applied to both sides one by one.
   * - `explore`: the learner picks transformations from a palette and applies
   *   them to both sides or to one side only.
   */
  mode: BalanceMode
  /**
   * `steps` only: the transformations as written next to an equation, e.g.
   * `['| - x', '| - 2', '| : 2']`. Allowed are `+ T` and `- T` (whole numbers
   * and whole multiples of the variable), `: n` for n from 2 to 6 if all
   * pieces split into n equal groups, and `· (-1)`.
   */
  steps?: string[]
  /** `explore` only: the palette, same syntax as `steps`. Default: `+ 1`, `- 1`, `+ x`, `- x`, `: 2`, `: 3`. */
  operations?: string[]
  /** Accessible name of the lines below the figure. Default: "Umformungen". */
  label?: string
}

export type BalanceMode = 'steps' | 'explore'

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
