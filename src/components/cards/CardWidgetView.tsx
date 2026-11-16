import type { CardWidget } from '../../cards'
import AreaModelView from './AreaModelView'
import BalanceView from './BalanceView'
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
    case 'area-model':
      return <AreaModelView widget={widget} />
    case 'balance':
      return <BalanceView widget={widget} />
  }
}
