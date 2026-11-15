import type { TopicId } from '../math'
import { ausmultiplizieren } from './ausmultiplizieren'
import { binomischeFormeln } from './binomische-formeln'
import { faktorisieren } from './faktorisieren'
import type { TopicContent } from './types'

export { allFormulas, findFormula, formulaGroupsOf, formulaLatex, formulaSheets } from './formulas'
export { chainPieces, chainToLatex, splitChain, splitMarkup, termToLatex, type Segment } from './markup'
export type { ExplanationSection, Formula, FormulaGroup, Markup, TopicContent, WorkedExample } from './types'

/** Explanations, worked examples and formulas per subtopic. */
export const topicContent = {
  'algebra/terme/ausmultiplizieren': ausmultiplizieren,
  'algebra/terme/binomische-formeln': binomischeFormeln,
  'algebra/terme/faktorisieren': faktorisieren,
} as const satisfies Record<TopicId, TopicContent>

export function findContent(id: string): TopicContent | undefined {
  return Object.hasOwn(topicContent, id) ? topicContent[id as keyof typeof topicContent] : undefined
}
