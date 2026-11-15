import type { CardWidget } from '../../cards'
import TermStepsView from './TermStepsView'

/**
 * Renders the interactive element of a card. New widget kinds get a case
 * here; the switch is exhaustive, so TypeScript reports a missing one.
 *
 * Widgets that use arrow keys themselves must call `preventDefault()` on
 * those key events, otherwise the deck also turns the card.
 */
export default function CardWidgetView({ widget }: { widget: CardWidget }) {
  switch (widget.kind) {
    case 'term-steps':
      return <TermStepsView widget={widget} />
  }
}
