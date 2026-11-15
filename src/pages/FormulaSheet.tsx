import Breadcrumb from '../components/Breadcrumb'
import FormulaList from '../components/FormulaList'
import { formulaGroups } from '../content'

/** All formulas of unit 1 on one page. */
export default function FormulaSheet() {
  return (
    <>
      <Breadcrumb current="formelsatz" />
      <h1>Formelsatz</h1>
      <p className="lead">Alle Formeln der Einheit „Terme und binomische Formeln“ auf einen Blick.</p>
      {formulaGroups.map((group) => (
        <section key={group.title} className="panel" aria-label={group.title}>
          <h2>{group.title}</h2>
          <FormulaList formulas={group.formulas} />
        </section>
      ))}
    </>
  )
}
