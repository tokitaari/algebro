import { Link } from 'react-router-dom'

/** Path above a page title, e.g. `einheit_1 / binomische_formeln`. The first part links to the start page. */
export default function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Pfad" className="crumbs">
      <Link to="/">einheit_1</Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{current}</span>
    </nav>
  )
}
