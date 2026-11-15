import { catalog, type Area } from '../catalog'
import Breadcrumb from '../components/Breadcrumb'
import FormulaList from '../components/FormulaList'
import { formulaGroupsOf } from '../content'

/** All formulas on one page, one section per topic of the catalog (topics without formulas are left out). */
export default function FormulaSheet({ areas = catalog }: { areas?: readonly Area[] }) {
  return (
    <>
      <Breadcrumb trail={['formelsatz']} />
      <h1>Formelsatz</h1>
      <p className="lead">Alle Formeln auf einen Blick, geordnet nach Themen.</p>
      {areas.flatMap((area) =>
        area.topics.flatMap((topic) => {
          const groups = formulaGroupsOf(area.slug, topic.slug)
          if (groups.length === 0) return []
          const headingId = `formeln-${area.slug}-${topic.slug}`
          return (
            <section key={headingId} className="panel" aria-labelledby={headingId}>
              <h2 id={headingId}>{topic.title}</h2>
              {groups.map((group) => (
                <div key={group.title}>
                  <h3>{group.title}</h3>
                  <FormulaList formulas={group.formulas} />
                </div>
              ))}
            </section>
          )
        }),
      )}
    </>
  )
}
