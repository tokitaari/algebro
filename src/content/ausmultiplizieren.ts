import { buildExpandTask } from '../math'
import { poly } from './poly'
import type { TopicContent } from './types'

/** Subtopic 1: multiplying out a product of two sums. */
export const ausmultiplizieren: TopicContent = {
  sections: [
    {
      heading: 'Worum geht es?',
      paragraphs: [
        'Steht ein Produkt aus zwei Klammern da, zum Beispiel $(x+3)(x-5)$, kannst du es in eine Summe ohne Klammern umwandeln. Das nennt man Ausmultiplizieren. Danach lässt sich der Term meistens noch vereinfachen.',
      ],
    },
    {
      heading: 'Die Regel: jeder mit jedem',
      paragraphs: [
        'Multipliziere jeden Summanden der ersten Klammer mit jedem Summanden der zweiten Klammer und addiere alle Produkte: $(a+b)(c+d) = ac+ad+bc+bd$.',
        'Hat jede Klammer zwei Summanden, entstehen also genau vier Produkte. Steht nur eine Zahl oder Variable vor der Klammer, sind es zwei: $a(b+c) = ab+ac$.',
      ],
    },
    {
      heading: 'Vorzeichen beachten',
      paragraphs: [
        'Das Rechenzeichen vor einem Summanden gehört zu ihm. In $(x+3)(x-5)$ ist der zweite Summand der zweiten Klammer also $-5$.',
        'Minus mal Plus ergibt Minus, Minus mal Minus ergibt Plus: $3·(-5) = -15$ und $(-2)·(-4) = 8$.',
      ],
    },
    {
      heading: 'Zusammenfassen',
      paragraphs: [
        'Zum Schluss fasst du gleichartige Terme zusammen. Das sind Terme mit denselben Variablen und denselben Exponenten, zum Beispiel $-5x+3x = -2x$. Zahlen ohne Variable fasst du ebenfalls zusammen.',
        'Ordne das Ergebnis am besten nach fallenden Exponenten: zuerst $x^2$, dann $x$, dann die Zahl.',
      ],
      steps: [
        'Jeden Summanden der ersten Klammer mit jedem Summanden der zweiten Klammer multiplizieren.',
        'Die einzelnen Produkte ausrechnen, dabei auf die Vorzeichen achten.',
        'Gleichartige Terme zusammenfassen.',
      ],
    },
  ],
  pitfalls: [
    'Kein Produkt vergessen: Bei zwei Klammern mit je zwei Summanden sind es immer vier Produkte.',
    'Gleiche Variablen multipliziert ergeben ein Quadrat: $x·x = x^2$, aber $x·x ≠ 2x$.',
  ],
  examples: [
    {
      title: 'Zahlen mit Vorzeichen',
      task: buildExpandTask(poly('x+3'), poly('x-5')),
      comment: 'Die beiden mittleren Produkte $-5x$ und $3x$ sind gleichartig und werden zu $-2x$ zusammengefasst.',
    },
    {
      title: 'Zwei Variablen',
      task: buildExpandTask(poly('2a+b'), poly('a-3b')),
      comment: '$ab$ und $ba$ sind gleichartig, denn beim Multiplizieren ist die Reihenfolge egal: $ba = ab$.',
    },
  ],
  formulaIds: ['distributive', 'sum-times-sum', 'same-variable', 'sign-minus-plus', 'sign-minus-minus'],
}
