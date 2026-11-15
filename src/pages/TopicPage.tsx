import { Link, useParams } from 'react-router-dom'
import FormulaList from '../components/FormulaList'
import Practice from '../components/Practice'
import RichText from '../components/RichText'
import WorkedExampleCard from '../components/WorkedExampleCard'
import { findContent, findFormula } from '../content'
import type { TopicId } from '../math'
import { findTopic } from '../topics'
import NotFound from './NotFound'

/** A subtopic: explanation, worked examples, formulas and the practice area. */
export default function TopicPage() {
  const { slug } = useParams()
  const topic = findTopic(slug)
  const content = topic && findContent(topic.slug)

  if (!topic || !content) return <NotFound />

  return (
    <>
      <p>
        <Link to="/">← Zur Startseite</Link>
      </p>
      <h1>{topic.title}</h1>
      <p className="lead">{topic.summary}</p>

      <section aria-labelledby="erklaerung" className="panel">
        <h2 id="erklaerung">Erklärung</h2>
        {content.sections.map((section) => (
          <div key={section.heading} className="explanation-section">
            <h3>{section.heading}</h3>
            {section.paragraphs.map((paragraph, i) => (
              <p key={i}>
                <RichText text={paragraph} />
              </p>
            ))}
            {section.steps && (
              <ol className="procedure">
                {section.steps.map((step, i) => (
                  <li key={i}>
                    <RichText text={step} />
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
        <aside className="pitfalls" aria-labelledby="achtung">
          <h3 id="achtung">Achtung, typische Fehler</h3>
          <ul>
            {content.pitfalls.map((pitfall, i) => (
              <li key={i}>
                <RichText text={pitfall} />
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section aria-labelledby="beispiele" className="panel">
        <h2 id="beispiele">Beispiele</h2>
        {content.examples.map((example, i) => (
          <WorkedExampleCard key={example.task.key} example={example} number={i + 1} />
        ))}
      </section>

      <section aria-labelledby="formeln" className="panel">
        <h2 id="formeln">Formeln</h2>
        <FormulaList formulas={content.formulaIds.map(findFormula)} />
        <p>
          <Link to="/formelsatz">Alle Formeln der Einheit im Formelsatz</Link>
        </p>
      </section>

      {/* Keyed by topic: switching subtopics starts a fresh series instead of reusing the old state. */}
      <Practice key={topic.slug} topic={topic.slug as TopicId} />
    </>
  )
}
