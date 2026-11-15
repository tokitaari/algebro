import CardDeck from '../../components/cards/CardDeck'
import { demoDeck } from './demoDeck'

/**
 * Demo of the card framework at /dev/karten. The route exists only in the
 * dev server (see src/routes.tsx), so neither this page nor the demo deck
 * ends up in the build.
 */
export default function CardsDemo() {
  return (
    <>
      <h1>Karten-Demo</h1>
      <p className="lead">
        Nur im Dev-Server sichtbar. Der Stand wird wie bei echten Karten im Browser gespeichert (Schlüssel <code>lemmio:cards</code>).
      </p>
      <section aria-labelledby="erklaerung" className="panel">
        <h2 id="erklaerung">Erklärung</h2>
        <CardDeck
          key={demoDeck.id}
          deck={demoDeck}
          finish={<p>Bei einem Teilthema steht hier der Link zur Übung.</p>}
        />
      </section>
    </>
  )
}
