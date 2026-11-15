import { Link, useParams } from 'react-router-dom'
import { findTopic } from '../topics'
import NotFound from './NotFound'

/**
 * Placeholder for a subtopic. The explanation (sub-task 3) and the practice
 * area (sub-task 4) will be added here later.
 */
export default function TopicPage() {
  const { slug } = useParams()
  const topic = findTopic(slug)

  if (!topic) return <NotFound />

  return (
    <>
      <p>
        <Link to="/">← Zur Startseite</Link>
      </p>
      <h1>{topic.title}</h1>
      <p className="lead">{topic.summary}</p>
      <section aria-labelledby="erklaerung" className="placeholder">
        <h2 id="erklaerung">Erklärung</h2>
        <p>Folgt: Kurzerklärung mit durchgerechnetem Beispiel.</p>
      </section>
      <section aria-labelledby="uebung" className="placeholder">
        <h2 id="uebung">Übung</h2>
        <p>Folgt: generierte Aufgaben mit Rückmeldung und Fortschritt.</p>
      </section>
    </>
  )
}
