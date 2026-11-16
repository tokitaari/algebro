import type { Card } from '../cards/types'
import type { Task } from '../math'

/** A paragraph or list item in explanation markup (see markup.ts). */
export type Markup = string

/** A fully worked example; the solution steps come from the math core. */
export interface WorkedExample {
  title: string
  task: Task
  /** Optional remark after the solution. */
  comment?: Markup
}

/** A formula in input syntax; both sides are typeset with `toLatex`. */
export interface Formula {
  id: string
  name: string
  lhs: string
  rhs: string
}

export interface FormulaGroup {
  title: string
  formulas: Formula[]
}

export interface TopicContent {
  /** Explanation as a deck of cards (see src/cards); the deck id is the subtopic's `TopicId`. */
  cards: Card[]
  examples: WorkedExample[]
  /** Formulas from the formula sheet that belong to this subtopic. */
  formulaIds: string[]
}
