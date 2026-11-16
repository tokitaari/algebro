import { entryLatex, type SheetEntry } from '../content'
import Tex from './Tex'

/** Formulas and rules with their names, e.g. for the formula sheet or a topic page. */
export default function FormulaList({ formulas }: { formulas: readonly SheetEntry[] }) {
  return (
    <dl className="formula-list">
      {formulas.map((formula) => (
        <div key={formula.id} className="formula">
          <dt>{formula.name}</dt>
          <dd>
            <Tex latex={entryLatex(formula)} display />
          </dd>
        </div>
      ))}
    </dl>
  )
}
