import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EquationStepsWidget } from '../../cards'
import { mockReducedMotion } from '../../test/matchMedia'
import EquationStepsView from './EquationStepsView'

const widget: EquationStepsWidget = {
  kind: 'equation-steps',
  start: '3x + 2 = x + 8',
  steps: [
    { operation: '| - x', equation: '2x + 2 = 8', note: '$x$ nach links' },
    { operation: '| - 2', equation: '2x = 6' },
    { operation: '| : 2', equation: 'x = 3' },
  ],
  solution: 'L = {3}',
}

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
  vi.restoreAllMocks()
})

function setup(w: EquationStepsWidget = widget) {
  const user = userEvent.setup()
  const view = render(<EquationStepsView widget={w} />)
  const lines = () => within(screen.getByRole('list', { name: w.label ?? 'Lösungsweg' })).getAllByRole('listitem')
  const live = () => view.container.querySelector('[aria-live="polite"]')
  return { user, view, lines, live }
}

describe('EquationStepsView', () => {
  it('writes the operation onto both sides first, then shows the simplified line', async () => {
    mockReducedMotion(true)
    const { user, view, lines, live } = setup()
    expect(lines()).toHaveLength(1)
    expect(screen.getByText('0 von 4 Schritten')).toBeInTheDocument()

    const step = screen.getByRole('button', { name: 'Nächster Schritt' })
    await user.click(step)
    expect(lines()).toHaveLength(2)
    expect(lines()[1]).toHaveClass('is-intermediate')
    expect(view.container.querySelectorAll('.equation-operand')).toHaveLength(2)
    expect(within(lines()[0]!).getByText('nach links', { exact: false })).toBeInTheDocument()
    expect(live()).toHaveTextContent('Auf beiden Seiten minus x: 3x + 2 - x = x + 8 - x.')
    expect(screen.getByText('0 von 4 Schritten')).toBeInTheDocument()

    await user.click(step)
    expect(lines()).toHaveLength(2)
    expect(lines()[1]).not.toHaveClass('is-intermediate')
    expect(view.container.querySelectorAll('.equation-operand')).toHaveLength(0)
    expect(live()).toHaveTextContent('Zusammengefasst: 2x + 2 = 8.')
    expect(screen.getByText('1 von 4 Schritten')).toBeInTheDocument()
  })

  it('shows everything at once with reduced motion and starts over', async () => {
    mockReducedMotion(true)
    const { user, lines, live } = setup()
    const all = screen.getByRole('button', { name: 'Alle zeigen' })
    await user.click(all)
    expect(lines()).toHaveLength(5)
    expect(lines().at(-1)).toHaveClass('solution-result')
    expect(all).toHaveAttribute('aria-disabled', 'true')
    expect(live()).toHaveTextContent('Lösungsmenge: L = {3}.')
    expect(screen.getByText('4 von 4 Schritten')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Von vorn' }))
    expect(lines()).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Nächster Schritt' })).toBeInTheDocument()
  })

  it('plays the frames one after another and can be stopped', async () => {
    const { user, lines, live } = setup()
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(lines()).toHaveLength(2)
    expect(live()).toHaveTextContent('Auf beiden Seiten minus x')

    await user.click(screen.getByRole('button', { name: 'Anhalten' }))
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument()
    expect(lines().length).toBeLessThan(5)
  })

  it('uses the label of the widget for the list', () => {
    render(<EquationStepsView widget={{ ...widget, label: 'Umformung' }} />)
    expect(screen.getByRole('list', { name: 'Umformung' })).toBeInTheDocument()
  })
})
