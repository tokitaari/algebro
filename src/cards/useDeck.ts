import { useState } from 'react'
import { initialDeckState, type DeckState } from './deck'
import { loadDeckState, saveDeckState } from './storage'
import type { Deck } from './types'

/**
 * State of a deck, kept in React state and mirrored to localStorage. Bind the
 * component that uses it to the deck with `key={deck.id}`, so switching decks
 * loads the right state.
 */
export function useDeck(deck: Deck) {
  const [state, setState] = useState<DeckState>(() => loadDeckState(deck))
  const [saveFailed, setSaveFailed] = useState(false)

  const update = (next: DeckState) => {
    if (next === state) return
    setState(next)
    setSaveFailed(!saveDeckState(deck, next))
  }

  return {
    state,
    /** True if the browser refused to store the state (it is then lost on reload). */
    saveFailed,
    update,
    restart: () => update(initialDeckState()),
  }
}
