import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <>
      <h1>Seite nicht gefunden</h1>
      <p>Diese Seite gibt es nicht – vielleicht hat sich ein Vorzeichen eingeschlichen.</p>
      <p>
        <Link to="/">Zur Startseite</Link>
      </p>
    </>
  )
}
