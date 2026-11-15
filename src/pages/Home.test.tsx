import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Area } from '../catalog'
import Home from './Home'

const areas: readonly Area[] = [
  {
    slug: 'algebra',
    title: 'Algebra',
    topics: [
      {
        slug: 'terme',
        title: 'Terme',
        summary: 'Terme umformen.',
        grade: 8,
        subtopics: [
          { slug: 'eins', title: 'Eins', summary: 'Erstes.' },
          { slug: 'zwei', title: 'Zwei', summary: 'Zweites.' },
        ],
      },
      {
        slug: 'funktionen',
        title: 'Funktionen',
        summary: 'Funktionen zeichnen.',
        grade: 9,
        subtopics: [{ slug: 'drei', title: 'Drei', summary: 'Drittes.' }],
      },
    ],
  },
  {
    slug: 'geometrie',
    title: 'Geometrie',
    topics: [
      {
        slug: 'winkel',
        title: 'Winkel',
        summary: 'Winkel messen.',
        grade: 9,
        subtopics: [{ slug: 'vier', title: 'Vier', summary: 'Viertes.' }],
      },
    ],
  },
]

function renderHome(search = '') {
  const router = createMemoryRouter([{ path: '/', element: <Home areas={areas} /> }], {
    initialEntries: [`/${search}`],
  })
  render(<RouterProvider router={router} />)
  return router
}

const topicRegion = (name: string) => within(screen.getByRole('region', { name }))

describe('home page', () => {
  it('groups the subtopics by area and topic', () => {
    renderHome()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Algebra', 'Geometrie'])
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Terme', 'Funktionen', 'Winkel'])
    expect(topicRegion('Terme').getAllByRole('link').map((l) => l.textContent)).toEqual([
      '1Eins' + 'Erstes.',
      '2Zwei' + 'Zweites.',
    ])
  })

  it('links the cards to area/topic/subtopic', () => {
    renderHome()
    expect(topicRegion('Funktionen').getByRole('link', { name: /Drei/ })).toHaveAttribute('href', '/algebra/funktionen/drei')
  })

  it('shows the school year of each topic as a badge', () => {
    renderHome()
    expect(topicRegion('Terme').getByText('Klasse 8')).toBeInTheDocument()
    expect(topicRegion('Funktionen').getByText('Klasse 9')).toBeInTheDocument()
    expect(topicRegion('Winkel').getByText('Klasse 9')).toBeInTheDocument()
  })

  it('offers "Alle" and every school year of the catalog, with "Alle" selected at first', () => {
    renderHome()
    const filter = within(screen.getByRole('group', { name: 'Klasse wählen' }))
    expect(filter.getAllByRole('button').map((b) => b.textContent)).toEqual(['Alle', 'Klasse 8', 'Klasse 9'])
    expect(filter.getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'true')
    expect(filter.getByRole('button', { name: 'Klasse 8' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filters topics by school year and drops areas without a match', async () => {
    const router = renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Klasse 9' }))
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Funktionen', 'Winkel'])
    expect(screen.getByRole('button', { name: 'Klasse 9' })).toHaveAttribute('aria-pressed', 'true')
    expect(router.state.location.search).toBe('?klasse=9')

    await userEvent.click(screen.getByRole('button', { name: 'Klasse 8' }))
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Algebra'])
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Terme'])

    await userEvent.click(screen.getByRole('button', { name: 'Alle' }))
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
    expect(router.state.location.search).toBe('')
  })

  it('takes the filter from the address', () => {
    renderHome('?klasse=8')
    expect(screen.getByRole('button', { name: 'Klasse 8' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Terme'])
  })

  it.each(['?klasse=7', '?klasse=abc', '?klasse=', '?klasse=8.5', '?klasse=-8'])('shows everything for the address %s', (search) => {
    renderHome(search)
    expect(screen.getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3)
  })

  it('does not change the history when the filter is changed', async () => {
    const router = renderHome()
    await userEvent.click(screen.getByRole('button', { name: 'Klasse 8' }))
    expect(router.state.historyAction).toBe('REPLACE')
  })
})
