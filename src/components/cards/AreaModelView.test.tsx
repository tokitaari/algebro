import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { areaFrame, buildAreaModel, type AreaModelWidget, type Deck } from '../../cards'
import { mockReducedMotion } from '../../test/matchMedia'
import AreaModelView from './AreaModelView'
import CardDeck from './CardDeck'

const expand: AreaModelWidget = { kind: 'area-model', first: ['x', '3'], second: ['x', '-5'], mode: 'expand' }
const factor: AreaModelWidget = { kind: 'area-model', first: ['x', '3'], second: ['x', '3'], mode: 'factor' }
const explore: AreaModelWidget = {
  kind: 'area-model',
  first: ['a', '-b'],
  second: ['a', '-b'],
  mode: 'explore',
  lengths: { a: { value: 6, min: 4, max: 9 }, b: { value: 2, min: 1, max: 3 } },
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
  vi.restoreAllMocks()
})

function setup(widget: AreaModelWidget) {
  const user = userEvent.setup()
  const view = render(<AreaModelView widget={widget} />)
  const lines = () => within(screen.getByRole('list', { name: 'Rechnung' })).getAllByRole('listitem')
  const live = () => view.container.querySelector('[aria-live="polite"]')
  return { user, view, lines, live }
}

describe('expand', () => {
  it('reveals a partial area when it is tapped and announces the product', async () => {
    const { user, lines, live } = setup(expand)
    expect(lines()).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: /^Teilfläche .* aufdecken$/ })).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Teilfläche 3 mal x aufdecken' }))
    expect(screen.queryByRole('button', { name: 'Teilfläche 3 mal x aufdecken' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '3 mal x gleich 3x' })).toBeInTheDocument()
    expect(live()).toHaveTextContent('3 mal x gleich 3x')
    expect(screen.getByText('1 von 5 Schritten')).toBeInTheDocument()
  })

  it('reveals the products row by row, combines like terms and starts over', async () => {
    const { user, lines } = setup(expand)
    const step = screen.getByRole('button', { name: 'Nächstes Produkt' })
    for (let i = 0; i < 4; i++) await user.click(step)
    expect(lines()).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'x mal (−5) gleich −5x' })).toBeInTheDocument()
    expect(step).toHaveTextContent('Zusammenfassen')
    await user.click(step)
    expect(lines()).toHaveLength(3)
    expect(within(screen.getByRole('list', { name: 'Gleichartige Terme' })).getAllByRole('listitem')).toHaveLength(1)
    expect(step).toHaveTextContent('Von vorn')
    expect(step).toHaveFocus()
    await user.click(step)
    expect(lines()).toHaveLength(1)
    expect(screen.queryByRole('list', { name: 'Gleichartige Terme' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /aufdecken$/ })).toHaveLength(4)
  })

  it('reveals partial areas with Enter and Space and moves the focus on', async () => {
    const { user } = setup(expand)
    act(() => screen.getByRole('button', { name: 'Teilfläche x mal x aufdecken' }).focus())
    await user.keyboard('{Enter}')
    expect(screen.getByRole('img', { name: 'x mal x gleich x²' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Teilfläche x mal (−5) aufdecken' })).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('button', { name: 'Teilfläche 3 mal x aufdecken' })).toHaveFocus()
  })

  it('plays the steps one after another and can be stopped', async () => {
    const { user } = setup(expand)
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(screen.getByText('1 von 5 Schritten')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Anhalten' }))
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument()
    expect(screen.getByText('1 von 5 Schritten')).toBeInTheDocument()
  })

  it('shows everything at once with reduced motion', async () => {
    mockReducedMotion(true)
    const { user, lines, live } = setup(expand)
    const all = screen.getByRole('button', { name: 'Alle zeigen' })
    await user.click(all)
    expect(lines()).toHaveLength(3)
    expect(all).toHaveAttribute('aria-disabled', 'true')
    expect(live()).toHaveTextContent('Ergebnis: x² − 2x − 15')
  })

  it('explains the sketch and the cut-off strips', () => {
    setup(expand)
    expect(screen.getByRole('group', { name: 'Flächenmodell für (x + 3)(x − 5)' })).toBeInTheDocument()
    expect(screen.getByText(/Skizze, nicht maßstabsgetreu\. Schraffierte Streifen werden abgezogen\./)).toBeInTheDocument()
  })
})

describe('factor', () => {
  it('reveals the sides one after another', async () => {
    const { user, lines, live } = setup(factor)
    // The figure gives the given sum, not the factors.
    expect(screen.getByRole('group', { name: 'Flächenmodell für x² + 6x + 9' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Teilfläche 3x' })).toHaveLength(2)
    expect(lines()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Linke Seite aufdecken' }))
    expect(screen.getByRole('img', { name: 'Linke Seite: x + 3' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Obere Seite aufdecken' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Nächster Schritt' }))
    expect(lines()).toHaveLength(3)
    expect(live()).toHaveTextContent('Obere Seite: x + 3. Produkt: (x + 3)²')
    expect(screen.getByRole('button', { name: 'Von vorn' })).toBeInTheDocument()
  })
})

describe('explore', () => {
  const valueOf = (name: string) => screen.getAllByRole('slider', { name: new RegExp(`^Länge ${name},`) }).map((s) => s.getAttribute('aria-valuenow'))

  it('has a slider on every variable edge and no step buttons', () => {
    setup(explore)
    expect(screen.getAllByRole('slider').map((s) => s.getAttribute('aria-label'))).toEqual([
      'Länge a, linke Kante',
      'Länge b, rechte Kante',
      'Länge a, obere Kante',
      'Länge b, untere Kante',
    ])
    expect(valueOf('a')).toEqual(['6', '6'])
    expect(screen.queryByRole('button', { name: 'Abspielen' })).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'a mal (−b) gleich −ab, Wert −12' })).toBeInTheDocument()
  })

  it('changes the lengths with the arrow keys within the range', async () => {
    const { user } = setup(explore)
    act(() => screen.getByRole('slider', { name: 'Länge a, linke Kante' }).focus())
    await user.keyboard('{ArrowRight}')
    expect(valueOf('a')).toEqual(['7', '7'])
    await user.keyboard('{End}')
    expect(valueOf('a')).toEqual(['9', '9'])
    await user.keyboard('{Home}{ArrowDown}')
    expect(valueOf('a')).toEqual(['4', '4'])
    expect(screen.getByRole('slider', { name: 'Länge a, linke Kante' })).toHaveAttribute('aria-valuetext', 'a = 4')
  })

  it('follows the pointer while dragging', () => {
    const { view } = setup(explore)
    const svg = view.container.querySelector('svg')!
    const frame = areaFrame(buildAreaModel(explore))
    const { width, height, x, y } = frame.view
    vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width,
      height,
      right: width,
      bottom: height,
      toJSON: () => ({}),
    } as DOMRect)
    // Box and viewBox have the same size, so client coordinates are viewBox coordinates shifted by the origin.
    const atX = (units: number) => units * frame.scale - x
    const atY = (units: number) => units * frame.scale - y

    const top = screen.getByRole('slider', { name: 'Länge a, obere Kante' })
    fireEvent.pointerDown(top, { pointerId: 1, button: 0, clientX: atX(6), clientY: atY(0) })
    expect(top).toHaveFocus()
    fireEvent.pointerMove(top, { pointerId: 1, clientX: atX(7.8), clientY: atY(0) })
    expect(valueOf('a')).toEqual(['8', '8'])
    fireEvent.pointerMove(top, { pointerId: 1, clientX: atX(20), clientY: atY(0) })
    expect(valueOf('a')).toEqual(['9', '9'])
    fireEvent.pointerUp(top, { pointerId: 1 })
    fireEvent.pointerMove(top, { pointerId: 1, clientX: atX(5), clientY: atY(0) })
    expect(valueOf('a')).toEqual(['9', '9'])

    // The strip handle sits at the inner edge a − b (now 9 − 2 = 7): outwards b shrinks, inwards it grows up to its maximum.
    const right = screen.getByRole('slider', { name: 'Länge b, rechte Kante' })
    fireEvent.pointerDown(right, { pointerId: 2, button: 0, clientX: atX(9), clientY: atY(7) })
    fireEvent.pointerMove(right, { pointerId: 2, clientX: atX(9), clientY: atY(8) })
    expect(valueOf('b')).toEqual(['1', '1'])
    fireEvent.pointerMove(right, { pointerId: 2, clientX: atX(9), clientY: atY(0) })
    expect(valueOf('b')).toEqual(['3', '3'])
    fireEvent.pointerCancel(right, { pointerId: 2 })
  })

  it('keeps the card when the arrow keys move a handle in a deck', async () => {
    const deck: Deck = {
      id: 'test/karten/flaeche',
      cards: [
        { id: 'ziehen', title: 'Ziehen', body: ['Zieh.'], widget: explore },
        { id: 'ende', title: 'Ende', body: ['Fertig.'] },
      ],
    }
    const user = userEvent.setup()
    render(<CardDeck deck={deck} />)
    act(() => screen.getByRole('slider', { name: 'Länge b, untere Kante' }).focus())
    await user.keyboard('{ArrowRight}{ArrowLeft}{ArrowLeft}')
    expect(screen.getByText('Karte 1 von 2')).toBeInTheDocument()
    expect(valueOf('b')).toEqual(['1', '1'])
  })
})
