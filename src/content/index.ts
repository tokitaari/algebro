import type { TopicId } from '../math'
import { ausmultiplizieren } from './ausmultiplizieren'
import { binomischeFormeln } from './binomische-formeln'
import { faktorisieren } from './faktorisieren'
import { gleichungenKlammern } from './gleichungen-klammern'
import { gleichungenSonderfaelle } from './gleichungen-sonderfaelle'
import { gleichungenUmformen } from './gleichungen-umformen'
import type { TopicContent } from './types'

export {
  allEntries,
  allFormulas,
  entryLatex,
  findFormula,
  formulaGroupsOf,
  formulaLatex,
  formulaSheets,
  isFormula,
  solutionSetSourceLatex,
} from './formulas'
export {
  chainPieces,
  chainToLatex,
  EQUATION_PREFIX,
  equationPieces,
  equationToLatexMarkup,
  segmentPieces,
  splitChain,
  splitMarkup,
  termToLatex,
  type Segment,
} from './markup'
export {
  isEquationTask,
  type EquivalenceRule,
  type Formula,
  type FormulaGroup,
  type Markup,
  type SheetEntry,
  type SolutionSetRule,
  type TopicContent,
  type WorkedExample,
} from './types'

/** Explanations, worked examples and formulas per subtopic. */
export const topicContent = {
  'algebra/terme/ausmultiplizieren': ausmultiplizieren,
  'algebra/terme/binomische-formeln': binomischeFormeln,
  'algebra/terme/faktorisieren': faktorisieren,
  'algebra/lineare-gleichungen/umformen': gleichungenUmformen,
  'algebra/lineare-gleichungen/klammern': gleichungenKlammern,
  'algebra/lineare-gleichungen/sonderfaelle': gleichungenSonderfaelle,
} as const satisfies Record<TopicId, TopicContent>

export function findContent(id: string): TopicContent | undefined {
  return Object.hasOwn(topicContent, id) ? topicContent[id as keyof typeof topicContent] : undefined
}
