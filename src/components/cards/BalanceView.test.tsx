import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BalanceWidget, Deck } from '../../cards'
import { mockReducedMotion } from '../../test/matchMedia'
import BalanceView from './BalanceView'
import CardDeck from './CardDeck'

const steps: BalanceWidget = { kind: 'balance', equation: '3x + 2 = x + 8', mode: 'steps', steps: ['| - x', '| - 2', '| : 2'] }
const explore: BalanceWidget = { kind: 'balance', equation: '2x + 1 = 7', mode: 'explore' }

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
  vi.restoreAllMocks()
})

function setup(widget: BalanceWidget) {
  const user = userEvent.setup()
  const view = render(<BalanceView widget={widget} />)
  const lines = () => within(screen.getByRole('list', { name: 'Umformungen' })).getAllByRole('listitem')
  const live = () => view.container.querySelector('[aria-live="polite"]')
  const figure = () => screen.getByRole('img', { name: /^Waage\./ })
  const status = () => view.container.querySelector('.balance-status')
  const pieces = () => view.container.querySelectorAll('[data-piece]')
  return { user, view, lines, live, figure, status, pieces }
}

describe('steps', () => {
  it('describes the balance and applies the given steps to both sides', async () => {
    mockReducedMotion(true)
    const { user, lines, live, figure, pieces } = setup(steps)
    expect(figure()).toHaveAttribute(
      'aria-label',
      'Waage. Links: 3 x-Kästchen und 2 Gewichte. Rechts: 1 x-Kästchen und 8 Gewichte. Die Waage ist im Gleichgewicht.',
    )
    expect(pieces()).toHaveLength(14)
    expect(lines()).toHaveLength(1)

    const step = screen.getByRole('button', { name: 'Nächster Schritt' })
    await user.click(step)
    expect(lines()).toHaveLength(2)
    expect(screen.getByText('1 von 3 Schritten')).toBeInTheDocument()
    expect(live()).toHaveTextContent(
      'Auf beiden Seiten minus x: je 1 x-Ballon kommt dazu. Links heben sich 1 x-Kästchen und 1 x-Ballon auf. Rechts heben sich 1 x-Kästchen und 1 x-Ballon auf. Die Waage bleibt im Gleichgewicht. Jetzt: 2x + 2 = 8.',
    )
    expect(figure()).toHaveAttribute('aria-label', 'Waage. Links: 2 x-Kästchen und 2 Gewichte. Rechts: 8 Gewichte. Die Waage ist im Gleichgewicht.')

    await user.click(step)
    await user.click(step)
    expect(lines()).toHaveLength(4)
    expect(lines().at(-1)).toHaveClass('solution-result')
    expect(figure()).toHaveAttribute('aria-label', 'Waage. Links: 1 x-Kästchen. Rechts: 3 Gewichte. Die Waage ist im Gleichgewicht.')
    expect(live()).toHaveTextContent('Jetzt: x = 3. Das x-Kästchen liegt allein.')
    expect(pieces()).toHaveLength(4)

    expect(step).toHaveTextContent('Von vorn')
    await user.click(step)
    expect(lines()).toHaveLength(1)
    expect(step).toHaveTextContent('Nächster Schritt')
    expect(screen.getByText('0 von 3 Schritten')).toBeInTheDocument()
  })

  it('shows everything at once with reduced motion', async () => {
    mockReducedMotion(true)
    const { user, lines, live } = setup(steps)
    const all = screen.getByRole('button', { name: 'Alle zeigen' })
    await user.click(all)
    expect(lines()).toHaveLength(4)
    expect(all).toHaveAttribute('aria-disabled', 'true')
    expect(live()).toHaveTextContent('Alle Schritte gezeigt. Jetzt: x = 3. Das x-Kästchen liegt allein.')
    expect(screen.getByText('3 von 3 Schritten')).toBeInTheDocument()
  })

  it('shows the pictures of a step one after another and can be stopped', async () => {
    const { user, view, lines, live, figure } = setup(steps)
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    // First picture: the balloons have arrived, nothing has cancelled yet.
    expect(lines()).toHaveLength(2)
    expect(live()).toHaveTextContent('Auf beiden Seiten minus x: je 1 x-Ballon kommt dazu.')
    expect(figure()).toHaveAttribute(
      'aria-label',
      'Waage. Links: 3 x-Kästchen, 1 x-Ballon und 2 Gewichte. Rechts: 1 x-Kästchen, 1 x-Ballon und 8 Gewichte. Die Waage ist im Gleichgewicht.',
    )
    expect(view.container.querySelectorAll('[data-piece$="-box-balloon-0"]')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'Anhalten' }))
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument()
    expect(screen.getByText('1 von 3 Schritten')).toBeInTheDocument()
    expect(figure()).toHaveAttribute('aria-label', 'Waage. Links: 2 x-Kästchen und 2 Gewichte. Rechts: 8 Gewichte. Die Waage ist im Gleichgewicht.')
  })

  it('uses the label of the widget for the lines', () => {
    render(<BalanceView widget={{ ...steps, label: 'Lösungsweg' }} />)
    expect(screen.getByRole('list', { name: 'Lösungsweg' })).toBeInTheDocument()
  })
})

describe('explore', () => {
  it('tips when only one side is transformed and levels again with the other side', async () => {
    mockReducedMotion(true)
    const { user, lines, live, figure, status } = setup(explore)
    expect(screen.getByRole('radio', { name: 'beide Seiten' })).toBeChecked()
    expect(status()).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'nur links' }))
    await user.click(screen.getByRole('button', { name: '− 1' }))
    expect(figure()).toHaveAttribute('aria-label', 'Waage. Links: 2 x-Kästchen. Rechts: 7 Gewichte. Die rechte Seite ist schwerer.')
    expect(live()).toHaveTextContent('Die Waage kippt: Die rechte Seite ist jetzt schwerer. Jetzt: 2x ≠ 7.')
    expect(status()).toHaveTextContent('Du hast nur eine Seite verändert.')
    expect(lines()).toHaveLength(2)
    expect(lines()[0]).toHaveTextContent('(nur links)')

    await user.click(screen.getByRole('radio', { name: 'nur rechts' }))
    await user.click(screen.getByRole('button', { name: '− 1' }))
    expect(live()).toHaveTextContent('Die Waage ist wieder im Gleichgewicht. Jetzt: 2x = 6.')
    expect(status()).not.toBeInTheDocument()
    expect(lines()).toHaveLength(3)
    expect(lines()[1]).toHaveTextContent('(nur rechts)')
  })

  it('refuses a division that leaves pieces over, solves the equation and takes steps back', async () => {
    mockReducedMotion(true)
    const { user, lines, live, status } = setup(explore)
    const undo = screen.getByRole('button', { name: 'Rückgängig' })
    expect(undo).toHaveAttribute('aria-disabled', 'true')

    await user.click(screen.getByRole('button', { name: ': 2' }))
    expect(lines()).toHaveLength(1)
    expect(status()).toHaveTextContent('Durch 2 lässt sich hier nicht teilen: Die Stücke gehen nicht in 2 gleiche Gruppen auf.')
    expect(live()).toHaveTextContent('Durch 2 lässt sich hier nicht teilen')

    await user.click(screen.getByRole('button', { name: '− 1' }))
    expect(status()).not.toBeInTheDocument()
    expect(undo).not.toHaveAttribute('aria-disabled')
    await user.click(screen.getByRole('button', { name: ': 2' }))
    expect(lines()).toHaveLength(3)
    expect(lines().at(-1)).toHaveClass('solution-result')
    expect(status()).toHaveTextContent('Geschafft: x = 3.')

    await user.click(undo)
    expect(lines()).toHaveLength(2)
    expect(live()).toHaveTextContent('Schritt zurückgenommen. Jetzt: 2x = 6.')
    expect(status()).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Von vorn' }))
    expect(lines()).toHaveLength(1)
    expect(live()).toHaveTextContent('Von vorn. Jetzt: 2x + 1 = 7.')
  })

  it('offers the operations of the widget', () => {
    render(<BalanceView widget={{ ...explore, operations: ['| - 1', '| · (-1)'] }} />)
    const palette = screen.getByRole('group', { name: 'Umformung' })
    expect(within(palette).getAllByRole('button').map((button) => button.textContent)).toEqual(['− 1', '· (−1)'])
  })

  it('keeps the card when the arrow keys choose where to transform in a deck', () => {
    const deck: Deck = {
      id: 'test/karten/waage',
      cards: [
        { id: 'waage', title: 'Waage', body: ['Forme um.'], widget: explore },
        { id: 'ende', title: 'Ende', body: ['Fertig.'] },
      ],
    }
    render(<CardDeck deck={deck} />)
    // The radio group moves its choice with the arrow keys itself; the deck must not turn the card as well.
    fireEvent.keyDown(screen.getByRole('radio', { name: 'beide Seiten' }), { key: 'ArrowRight' })
    expect(screen.getByText('Karte 1 von 2')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('button', { name: '− 1' }), { key: 'ArrowRight' })
    expect(screen.getByText('Karte 2 von 2')).toBeInTheDocument()
  })
})
