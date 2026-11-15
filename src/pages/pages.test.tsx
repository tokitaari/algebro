import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { allFormulas, formulaGroups, topicContent } from '../content'
import { TOPIC_IDS } from '../math'
import { routes } from '../routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const { container } = render(<RouterProvider router={router} />)
  return { router, container }
}

describe('topic page', () => {
  it.each(TOPIC_IDS)('%s shows explanation, worked examples and formulas', (topic) => {
    const content = topicContent[topic]
    const { container } = renderAt(`/${topic}`)

    for (const section of content.sections) {
      expect(screen.getByRole('heading', { level: 3, name: section.heading })).toBeInTheDocument()
    }
    expect(screen.getByRole('heading', { level: 3, name: 'Achtung, typische Fehler' })).toBeInTheDocument()

    const examples = within(screen.getByRole('region', { name: 'Beispiele' }))
    content.examples.forEach((example, i) => {
      const card = within(examples.getByRole('article', { name: `Beispiel ${i + 1}: ${example.title}` }))
      const steps = within(card.getByRole('list', { name: 'Lösungsweg' })).getAllByRole('listitem')
      expect(steps).toHaveLength(example.task.steps.length + 1)
      for (const step of example.task.steps) if (step.note) expect(card.getByText(step.note)).toBeInTheDocument()
    })

    const formulas = within(screen.getByRole('region', { name: 'Formeln' }))
    expect(formulas.getAllByRole('term')).toHaveLength(content.formulaIds.length)

    // Formulas are typeset by KaTeX (HTML plus MathML) and none failed to render.
    expect(container.querySelectorAll('.katex').length).toBeGreaterThan(10)
    expect(container.querySelectorAll('math').length).toBeGreaterThan(10)
    expect(container.querySelector('.katex-error')).toBeNull()
  })

  it('links to the formula sheet', async () => {
    const { router } = renderAt('/binomische-formeln')
    await userEvent.click(screen.getByRole('link', { name: /Formelsatz/ }))
    expect(router.state.location.pathname).toBe('/formelsatz')
  })
})

describe('formula sheet', () => {
  it('shows every formula, grouped', () => {
    const { container } = renderAt('/formelsatz')
    expect(screen.getByRole('heading', { level: 1, name: 'Formelsatz' })).toBeInTheDocument()
    for (const group of formulaGroups) {
      const region = within(screen.getByRole('region', { name: group.title }))
      expect(region.getAllByRole('term')).toHaveLength(group.formulas.length)
    }
    expect(container.querySelectorAll('.katex-display')).toHaveLength(allFormulas.length)
    expect(container.querySelector('.katex-error')).toBeNull()
  })

  it('is linked from the home page', async () => {
    const { router } = renderAt('/')
    await userEvent.click(within(screen.getByRole('main')).getByRole('link', { name: 'Formelsatz' }))
    expect(router.state.location.pathname).toBe('/formelsatz')
  })
})
