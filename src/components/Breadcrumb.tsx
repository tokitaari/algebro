import { Link } from 'react-router-dom'

/**
 * Path above a page title, e.g. `start / algebra / terme / binomische_formeln`.
 * `trail` holds the slugs from the catalog (hyphens are shown as underscores);
 * the last one is the current page. "start" links to the start page.
 */
export default function Breadcrumb({ trail }: { trail: readonly string[] }) {
  const parents = trail.slice(0, -1)
  const current = trail[trail.length - 1]
  return (
    <nav aria-label="Pfad" className="crumbs">
      <Link to="/">start</Link>
      {parents.map((slug, index) => (
        <Crumb key={index} label={slug} />
      ))}
      <span aria-hidden="true">/</span>
      <span aria-current="page">{current?.replaceAll('-', '_')}</span>
    </nav>
  )
}

function Crumb({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true">/</span>
      <span>{label.replaceAll('-', '_')}</span>
    </>
  )
}
