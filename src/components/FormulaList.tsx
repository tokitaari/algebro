import { formulaLatex, type Formula } from '../content'
import Tex from './Tex'

/** Formulas with their names, e.g. for the formula sheet or a topic page. */
export default function FormulaList({ formulas }: { formulas: readonly Formula[] }) {
  return (
    <dl className="formula-list">
      {formulas.map((formula) => (
        <div key={formula.id} className="formula">
          <dt>{formula.name}</dt>
          <dd>
            <Tex latex={formulaLatex(formula)} display />
          </dd>
        </div>
      ))}
    </dl>
  )
}
