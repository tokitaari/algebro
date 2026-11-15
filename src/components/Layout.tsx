import { Link, NavLink, Outlet } from 'react-router-dom'
import { topics } from '../topics'

export default function Layout() {
  return (
    <div className="app">
      <a className="skip-link" href="#inhalt">
        Zum Inhalt springen
      </a>
      <header className="app-header">
        <Link to="/" className="brand">
          Lemmio
        </Link>
        <nav aria-label="Teilthemen" className="topic-nav">
          {topics.map((topic) => (
            <NavLink key={topic.slug} to={`/${topic.slug}`}>
              {topic.title}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="inhalt" className="app-main">
        <Outlet />
      </main>
      <footer className="app-footer">
        Lemmio · Einheit 1: Terme und binomische Formeln · Dein Fortschritt bleibt in deinem Browser.
      </footer>
    </div>
  )
}
