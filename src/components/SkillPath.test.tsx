import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import SkillPath from './SkillPath'

describe('SkillPath', () => {
  it('shows one node per task with its state as text', () => {
    render(<SkillPath total={5} outcomes={['correct', 'wrong']} current={2} label="Fortschritt" />)
    const nodes = within(screen.getByRole('list', { name: 'Fortschritt' })).getAllByRole('listitem')
    expect(nodes).toHaveLength(5)
    expect(nodes[0]).toHaveTextContent('Aufgabe 1: richtig')
    expect(nodes[1]).toHaveTextContent('Aufgabe 2: falsch')
    expect(nodes[2]).toHaveTextContent('Aufgabe 3: aktuell')
    expect(nodes[3]).toHaveTextContent('Aufgabe 4: offen')
    expect(nodes[4]).toHaveTextContent('Aufgabe 5: offen')
  })

  it('marks only the current node and backs up the result colours with glyphs', () => {
    render(<SkillPath total={3} outcomes={['correct', 'wrong']} current={2} label="Fortschritt" />)
    const nodes = screen.getAllByRole('listitem')
    expect(nodes.map((node) => node.getAttribute('aria-current'))).toEqual([null, null, 'step'])
    expect(nodes[0]).toHaveTextContent('✓')
    expect(nodes[1]).toHaveTextContent('✗')
  })

  it('has no current node once the series is over', () => {
    render(<SkillPath total={2} outcomes={['correct', 'correct']} label="Ergebnis" />)
    for (const node of screen.getAllByRole('listitem')) expect(node).not.toHaveAttribute('aria-current')
  })
})
