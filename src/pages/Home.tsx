import { Link, useSearchParams } from 'react-router-dom'
import { catalog, filterByGrade, gradeLabel, gradesOf, subtopicPath, type Area } from '../catalog'

/** Query parameter of the class filter, e.g. `/?klasse=8`. */
const GRADE_PARAM = 'klasse'

/** Start page: all subtopics by area and topic, with the school year as a badge and a filter by year. */
export default function Home({ areas = catalog }: { areas?: readonly Area[] }) {
  const [params, setParams] = useSearchParams()
  const grades = gradesOf(areas)
  // An unknown or malformed value counts as "all".
  const requested = Number(params.get(GRADE_PARAM))
  const grade = grades.includes(requested) ? requested : null
  const visible = filterByGrade(areas, grade)

  const select = (next: number | null) => setParams(next === null ? {} : { [GRADE_PARAM]: String(next) }, { replace: true })

  return (
    <>
      <p className="eyebrow">start</p>
      <h1>Willkommen bei Lemmio</h1>
      <p className="lead">Hier übst du Mathe Schritt für Schritt. Such dir ein Thema aus und leg los.</p>

      <div role="group" aria-label="Klasse wählen" className="filter">
        <button type="button" className="filter-option" aria-pressed={grade === null} onClick={() => select(null)}>
          Alle
        </button>
        {grades.map((g) => (
          <button key={g} type="button" className="filter-option" aria-pressed={grade === g} onClick={() => select(g)}>
            {gradeLabel(g)}
          </button>
        ))}
      </div>

      {visible.map((area) => (
        <section key={area.slug} aria-labelledby={`bereich-${area.slug}`} className="catalog-area">
          <h2 id={`bereich-${area.slug}`}>{area.title}</h2>
          {area.topics.map((topic) => {
            const headingId = `thema-${area.slug}-${topic.slug}`
            return (
              <section key={topic.slug} aria-labelledby={headingId} className="catalog-topic">
                <div className="topic-head">
                  <h3 id={headingId}>{topic.title}</h3>
                  <span className="badge">{gradeLabel(topic.grade)}</span>
                </div>
                <p className="topic-summary">{topic.summary}</p>
                <ul className="card-list">
                  {topic.subtopics.map((subtopic, index) => (
                    <li key={subtopic.slug}>
                      <Link to={subtopicPath(`${area.slug}/${topic.slug}/${subtopic.slug}` as const)} className="card">
                        <span className="card-number" aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className="card-body">
                          <span className="card-title">{subtopic.title}</span>
                          <span className="card-summary">{subtopic.summary}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </section>
      ))}

      <p className="home-formulas">
        Alle Formeln auf einen Blick: <Link to="/formelsatz">Formelsatz</Link>
      </p>
    </>
  )
}
