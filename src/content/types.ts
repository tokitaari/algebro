import type { Card } from '../cards/types'
import type { Task } from '../math'

/** A paragraph or list item in explanation markup (see markup.ts). */
export type Markup = string

export interface ExplanationSection {
  heading: string
  paragraphs: Markup[]
  /** Optional ordered list after the paragraphs, e.g. a procedure. */
  steps?: Markup[]
}

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
  /**
   * Explanation as a deck of cards (see src/cards). When present, the topic
   * page shows the cards instead of `sections` and `pitfalls`; the old format
   * stays until every subtopic has cards.
   */
  cards?: Card[]
  sections: ExplanationSection[]
  /** Common mistakes, shown in a highlighted box. */
  pitfalls: Markup[]
  examples: WorkedExample[]
  /** Formulas from the formula sheet that belong to this subtopic. */
  formulaIds: string[]
}
