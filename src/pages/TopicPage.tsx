import { Link, useParams } from 'react-router-dom'
import Breadcrumb from '../components/Breadcrumb'
import CardDeck from '../components/cards/CardDeck'
import FormulaList from '../components/FormulaList'
import Practice from '../components/Practice'
import RichText from '../components/RichText'
import WorkedExampleCard from '../components/WorkedExampleCard'
import { findSubtopic } from '../catalog'
import { findContent, findFormula } from '../content'
import NotFound from './NotFound'

/**
 * A subtopic at `/area/topic/subtopic`: explanation, worked examples, formulas
 * and the practice area. The explanation is a card deck if the content has
 * cards, otherwise the former sections with pitfalls.
 */
export default function TopicPage() {
  const params = useParams()
  const ref = findSubtopic(params.area, params.topic, params.subtopic)
  const content = ref && findContent(ref.id)

  if (!ref || !content) return <NotFound />
  const { id, area, topic, subtopic } = ref

  return (
    <>
      <Breadcrumb trail={[area.slug, topic.slug, subtopic.slug]} />
      <h1>{subtopic.title}</h1>
      <p className="lead">{subtopic.summary}</p>

      <section aria-labelledby="erklaerung" className="panel">
        <h2 id="erklaerung">Erklärung</h2>
        {content.cards ? (
          <CardDeck
            key={id}
            deck={{ id, cards: content.cards }}
            finish={
              <p>
                <a href="#uebung" className="btn btn-primary">
                  Weiter zur Übung
                </a>
              </p>
            }
          />
        ) : (
          <>
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
          </>
        )}
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
          <Link to="/formelsatz">Alle Formeln im Formelsatz</Link>
        </p>
      </section>

      {/* Keyed by id: switching subtopics starts a fresh series instead of reusing the old state. */}
      <Practice key={id} topic={id} />
    </>
  )
}
