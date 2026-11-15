import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARDS_STORAGE_KEY, type Deck } from '../../cards'
import { mockReducedMotion } from '../../test/matchMedia'
import CardDeck from './CardDeck'

const deck: Deck = {
  id: 'test/karten/deck',
  cards: [
    { id: 'intro', title: 'Intro', body: ['Hallo $x$.'] },
    {
      id: 'schritte',
      title: 'Schritte',
      body: ['Sieh zu.'],
      widget: {
        kind: 'term-steps',
        start: '(x+1)^2',
        steps: [{ term: '(x+1)(x+1)' }, { term: 'x^2+2x+1', note: 'Zusammenfassen' }],
      },
    },
    {
      id: 'auswahl',
      title: 'Auswahl',
      body: ['Wähle.'],
      question: {
        kind: 'choice',
        prompt: 'Was ergibt $2·3$?',
        options: [{ text: '5', feedback: 'Das ist die Summe.' }, { text: '6', correct: true }],
        explanation: 'Es ist $2·3 = 6$.',
      },
    },
    {
      id: 'term',
      title: 'Term',
      body: ['Rechne.'],
      question: {
        kind: 'term',
        prompt: 'Multipliziere aus:',
        term: '(x+1)(x+2)',
        answer: 'x^2+3x+2',
        form: { kind: 'expanded' },
        explanation: 'Vier Produkte.',
      },
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia')
  vi.restoreAllMocks()
})

function setup() {
  const user = userEvent.setup()
  const view = render(<CardDeck deck={deck} finish={<p>Zur Übung</p>} />)
  const heading = (name: string) => screen.getByRole('heading', { level: 3, name })
  const weiter = () => screen.getByRole('button', { name: 'Weiter' })
  const status = () => within(screen.getByRole('status'))
  const pathButtons = () => within(screen.getByRole('list', { name: 'Karten' })).getAllByRole('button')
  const toChoice = async () => {
    await user.click(weiter())
    await user.click(weiter())
  }
  const solveChoice = async () => {
    await user.click(screen.getByRole('radio', { name: /^6/ }))
    await user.click(screen.getByRole('button', { name: 'Prüfen' }))
  }
  const typeAnswer = async (text: string) => {
    const input = screen.getByLabelText('Deine Antwort')
    await user.clear(input)
    await user.type(input, text)
    await user.click(screen.getByRole('button', { name: 'Prüfen' }))
  }
  return { user, view, heading, weiter, status, pathButtons, toChoice, solveChoice, typeAnswer }
}

describe('navigation', () => {
  it('shows the first card with its position and a path of all cards', () => {
    const { heading, pathButtons } = setup()
    expect(heading('Intro')).toBeInTheDocument()
    expect(screen.getByText('Karte 1 von 4')).toBeInTheDocument()
    const nodes = pathButtons()
    expect(nodes).toHaveLength(4)
    expect(nodes[0]).toHaveAccessibleName('Karte 1: Intro (aktuell)')
    expect(nodes[1]).toHaveAccessibleName('Karte 2: Schritte (offen)')
    expect(nodes[2]).toHaveAccessibleName('Karte 3: Auswahl (offen)')
    expect(nodes[3]).toHaveAccessibleName('Karte 4: Term (gesperrt)')
    expect(nodes[3]).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zurück' })).toBeDisabled()
  })

  it('turns to the next card with "Weiter" and moves the focus to its heading', async () => {
    const { user, heading, weiter } = setup()
    await user.click(weiter())
    expect(heading('Schritte')).toHaveFocus()
    expect(screen.getByText('Karte 2 von 4')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Zurück' }))
    expect(heading('Intro')).toHaveFocus()
  })

  it('turns the card with the arrow keys', async () => {
    const { user, heading, weiter } = setup()
    await user.click(weiter())
    await user.keyboard('{ArrowRight}')
    expect(heading('Auswahl')).toHaveFocus()
    // The question is open: no further.
    await user.keyboard('{ArrowRight}')
    expect(heading('Auswahl')).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(heading('Schritte')).toHaveFocus()
  })

  it('leaves arrow keys alone in fields and radio groups', async () => {
    const { user, toChoice, solveChoice, weiter } = setup()
    await toChoice()
    await solveChoice()
    await user.click(weiter())
    const input = screen.getByLabelText('Deine Antwort')
    await user.type(input, 'x+1')
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('Karte 4 von 4')).toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('jumps to a reached card via the path', async () => {
    const { user, toChoice, pathButtons, heading } = setup()
    await toChoice()
    await user.click(pathButtons()[0]!)
    expect(heading('Intro')).toHaveFocus()
    expect(pathButtons()[2]).toHaveAccessibleName('Karte 3: Auswahl (offen)')
  })

  it('locks "Weiter" until the question is answered and says why', async () => {
    const { user, toChoice, weiter, heading } = setup()
    await toChoice()
    expect(weiter()).toHaveAttribute('aria-disabled', 'true')
    expect(weiter()).toHaveAccessibleDescription('Beantworte zuerst die Frage, dann geht es weiter.')
    await user.click(weiter())
    expect(heading('Auswahl')).toBeInTheDocument()
  })
})

describe('choice question', () => {
  it('rejects a wrong option with its feedback and allows another try', async () => {
    const { user, toChoice, status } = setup()
    await toChoice()
    expect(screen.getByRole('button', { name: 'Prüfen' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Lösung anzeigen' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: '5' }))
    await user.click(screen.getByRole('button', { name: 'Prüfen' }))
    expect(status().getByText(/Leider nicht/)).toBeInTheDocument()
    expect(status().getByText('Das ist die Summe.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '5 (falsch)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lösung anzeigen' })).toBeInTheDocument()
  })

  it('accepts the right option, explains it and unlocks "Weiter"', async () => {
    const { toChoice, solveChoice, status, weiter } = setup()
    await toChoice()
    await solveChoice()
    expect(status().getByText('✓ Richtig!')).toBeInTheDocument()
    expect(screen.getByText(/Es ist/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '6 (richtig)' })).toBeDisabled()
    expect(weiter()).not.toHaveAttribute('aria-disabled')
    expect(weiter()).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Prüfen' })).not.toBeInTheDocument()
  })

  it('reveals the solution after a miss', async () => {
    const { user, toChoice, status, weiter } = setup()
    await toChoice()
    await user.click(screen.getByRole('radio', { name: '5' }))
    await user.click(screen.getByRole('button', { name: 'Prüfen' }))
    await user.click(screen.getByRole('button', { name: 'Lösung anzeigen' }))
    expect(status().getByText(/Hier ist die Lösung/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '6 (richtig)' })).toBeInTheDocument()
    expect(weiter()).toHaveFocus()
  })
})

describe('term question', () => {
  async function toTerm() {
    const s = setup()
    await s.toChoice()
    await s.solveChoice()
    await s.user.click(s.weiter())
    return s
  }

  it('shows the term and checks the answer with checkAnswer', async () => {
    const { typeAnswer, status } = await toTerm()
    expect(screen.getByText('Multipliziere aus:')).toBeInTheDocument()
    await typeAnswer('0')
    expect(status().getByText(/Noch nicht/)).toBeInTheDocument()
    expect(status().getByText('nicht äquivalent')).toBeInTheDocument()
    await typeAnswer('(x+1)(x+2)')
    expect(status().getByText(/gleichwertig, aber noch nicht in der gewünschten Form/)).toBeInTheDocument()
    expect(status().getByText('Form nicht ok')).toBeInTheDocument()
  })

  it('reports unreadable input and keeps the focus in the field', async () => {
    const { typeAnswer, status } = await toTerm()
    await typeAnswer('x+')
    expect(status().getByText(/Das kann ich nicht lesen/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lösung anzeigen' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Deine Antwort')).toHaveFocus()
  })

  it('accepts an equivalent answer, shows the model answer and completes the deck', async () => {
    const { typeAnswer, status } = await toTerm()
    await typeAnswer('2+3x+x^2')
    expect(status().getByText('✓ Richtig!')).toBeInTheDocument()
    expect(status().getByText('Form ok')).toBeInTheDocument()
    expect(screen.getByText(/Musterlösung/)).toBeInTheDocument()
    expect(screen.getByLabelText('Deine Antwort')).toHaveAttribute('readonly')
    expect(screen.getByRole('heading', { name: 'Alle Karten geschafft' })).toHaveFocus()
    expect(screen.getByText('Zur Übung')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Weiter' })).not.toBeInTheDocument()
  })

  it('starts over on request and forgets the stored state', async () => {
    const { user, typeAnswer, heading } = await toTerm()
    await typeAnswer('x^2+3x+2')
    expect(localStorage.getItem(CARDS_STORAGE_KEY)).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Von vorn beginnen' }))
    expect(heading('Intro')).toHaveFocus()
    expect(localStorage.getItem(CARDS_STORAGE_KEY)).toBeNull()
  })
})

describe('stored state', () => {
  it('continues where the learner left off after a reload', async () => {
    const { view, toChoice, solveChoice } = setup()
    await toChoice()
    await solveChoice()
    view.unmount()
    render(<CardDeck deck={deck} />)
    expect(screen.getByText('Karte 3 von 4')).toBeInTheDocument()
    expect(within(screen.getByRole('status')).getByText('✓ Schon gelöst.')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: '6 (richtig)' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Weiter' })).not.toHaveAttribute('aria-disabled')
  })

  it('warns when the browser refuses to save', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const { user, weiter } = setup()
    await user.click(weiter())
    expect(screen.getByRole('alert')).toHaveTextContent(/kein Speichern/)
  })
})

describe('term steps widget', () => {
  async function toSteps() {
    const s = setup()
    await s.user.click(s.weiter())
    const lines = () => within(screen.getByRole('list', { name: 'Umformung' })).getAllByRole('listitem')
    return { ...s, lines }
  }

  it('reveals one line per click and starts over at the end', async () => {
    const { user, lines } = await toSteps()
    expect(lines()).toHaveLength(1)
    expect(screen.getByText('0 von 2 Schritten')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Nächster Schritt' }))
    expect(lines()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Nächster Schritt' }))
    expect(lines()).toHaveLength(3)
    expect(screen.getByText('Zusammenfassen')).toBeInTheDocument()
    const again = screen.getByRole('button', { name: 'Von vorn' })
    expect(again).toHaveFocus()
    await user.click(again)
    expect(lines()).toHaveLength(1)
  })

  it('plays the lines one after another and can be stopped', async () => {
    const { user, lines } = await toSteps()
    await user.click(screen.getByRole('button', { name: 'Abspielen' }))
    expect(lines()).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Anhalten' }))
    expect(screen.getByRole('button', { name: 'Abspielen' })).toBeInTheDocument()
    expect(lines()).toHaveLength(2)
  })

  it('shows all lines at once with reduced motion', async () => {
    mockReducedMotion(true)
    const { user, lines } = await toSteps()
    const all = screen.getByRole('button', { name: 'Alle zeigen' })
    await user.click(all)
    expect(lines()).toHaveLength(3)
    expect(all).toHaveAttribute('aria-disabled', 'true')
  })

  it('starts fresh on every visit of the card', async () => {
    const { user, lines, weiter } = await toSteps()
    await user.click(screen.getByRole('button', { name: 'Nächster Schritt' }))
    await user.click(weiter())
    await user.keyboard('{ArrowLeft}')
    expect(lines()).toHaveLength(1)
  })
})
