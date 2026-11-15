import { Link } from 'react-router-dom'
import { topics } from '../topics'

export default function Home() {
  return (
    <>
      <p className="eyebrow">einheit_1 · terme_und_binomische_formeln</p>
      <h1>Willkommen bei Lemmio</h1>
      <p className="lead">
        Hier übst du Algebra Schritt für Schritt: Klammern auflösen, Formeln durchschauen, Terme zerlegen.
        Einheit 1 hat drei Themen – such dir eins aus:
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
      <p className="home-formulas">
        Alle Formeln auf einen Blick: <Link to="/formelsatz">Formelsatz</Link>
      </p>
    </>
  )
}
