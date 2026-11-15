import type { TopicId } from '../math'
import { ausmultiplizieren } from './ausmultiplizieren'
import { binomischeFormeln } from './binomische-formeln'
import { faktorisieren } from './faktorisieren'
import type { TopicContent } from './types'

export { allFormulas, findFormula, formulaGroups, formulaLatex } from './formulas'
export { chainPieces, chainToLatex, splitChain, splitMarkup, termToLatex, type Segment } from './markup'
export type { ExplanationSection, Formula, FormulaGroup, Markup, TopicContent, WorkedExample } from './types'

/** Explanations, worked examples and formulas per subtopic of unit 1. */
export const topicContent: Readonly<Record<TopicId, TopicContent>> = {
  ausmultiplizieren,
  'binomische-formeln': binomischeFormeln,
  faktorisieren,
}

export function findContent(slug: string): TopicContent | undefined {
  return Object.hasOwn(topicContent, slug) ? topicContent[slug as TopicId] : undefined
}
