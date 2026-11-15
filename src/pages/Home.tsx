import { Link } from 'react-router-dom'
import { topics } from '../topics'

export default function Home() {
  return (
    <>
      <h1>Willkommen bei Algebro</h1>
      <p className="lead">
        Hier übst du Algebra Schritt für Schritt. Einheit 1: Terme und binomische Formeln.
        Wähle ein Thema:
      </p>
      <ul className="card-list">
        {topics.map((topic, index) => (
          <li key={topic.slug}>
            <Link to={`/${topic.slug}`} className="card">
              <span className="card-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="card-body">
                <span className="card-title">{topic.title}</span>
                <span className="card-summary">{topic.summary}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
