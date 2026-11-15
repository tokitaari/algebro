import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'
import { topics } from './topics'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Routing and layout', () => {
  it('shows all three subtopics on the home page', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: /Willkommen bei Algebro/ })).toBeInTheDocument()
    expect(topics).toHaveLength(3)
    const main = within(screen.getByRole('main'))
    for (const topic of topics) {
      expect(main.getByRole('link', { name: new RegExp(topic.title) })).toBeInTheDocument()
    }
  })

  it.each(topics)('shows the placeholder for "$title"', ({ slug, title }) => {
    renderAt(`/${slug}`)
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Erklärung' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Übung' })).toBeInTheDocument()
  })

  it('navigates from the home page to a subtopic on click', async () => {
    const router = renderAt('/')
    await userEvent.click(within(screen.getByRole('main')).getByRole('link', { name: /Faktorisieren/ }))
    expect(router.state.location.pathname).toBe('/faktorisieren')
  })

  it('shows the navigation with all subtopics in the layout', () => {
    renderAt('/')
    const nav = within(screen.getByRole('navigation', { name: 'Teilthemen' }))
    expect(nav.getAllByRole('link')).toHaveLength(topics.length)
  })

  it('shows "not found" for an unknown subtopic', () => {
    renderAt('/gibt-es-nicht')
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })

  it('shows "not found" for nested unknown paths', () => {
    renderAt('/a/b/c')
    expect(screen.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeInTheDocument()
  })
})
