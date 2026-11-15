import type { Deck } from '../../cards'

/**
 * Demo deck for the card framework, shown at /dev/karten in the dev server
 * only. It uses every card feature once; real decks arrive with the subtopics.
 */
export const demoDeck: Deck = {
  id: 'dev/karten/demo',
  cards: [
    {
      id: 'start',
      title: 'Worum geht es?',
      body: [
        'Steht ein Produkt aus zwei Klammern da, zum Beispiel $(x+3)(x-5)$, kannst du es in eine Summe ohne Klammern umwandeln.',
        'Diese Karte hat keine Frage. Mit „Weiter“ oder der Pfeiltaste → geht es zur nächsten Karte.',
      ],
    },
    {
      id: 'jeder-mit-jedem',
      title: 'Jeder mit jedem',
      body: ['Multipliziere jeden Summanden der ersten Klammer mit jedem Summanden der zweiten Klammer.'],
      widget: {
        kind: 'term-steps',
        label: 'Lösungsweg',
        start: '(x+3)(x-5)',
        steps: [
          { term: 'x·x + x·(-5) + 3·x + 3·(-5)', note: 'Jeder mit jedem' },
          { term: 'x^2 - 5x + 3x - 15', note: 'Produkte ausrechnen' },
          { term: 'x^2 - 2x - 15', note: 'Zusammenfassen' },
        ],
      },
      question: {
        kind: 'choice',
        prompt: 'Wie viele Produkte entstehen beim Ausmultiplizieren von $(a+b)(c+d)$?',
        options: [
          { text: '2', feedback: 'Das wären nur die Produkte mit $a$. Auch $b$ wird mit beiden Summanden multipliziert.' },
          { text: '4', correct: true },
          { text: '8', feedback: 'Jeder Summand links trifft jeden Summanden rechts genau einmal.' },
        ],
        explanation: 'Zwei Summanden mal zwei Summanden ergibt $2·2 = 4$ Produkte: $(a+b)(c+d) = ac+ad+bc+bd$.',
      },
    },
    {
      id: 'vorzeichen',
      title: 'Vorzeichen',
      body: ['Das Rechenzeichen vor einem Summanden gehört zu ihm.'],
      question: {
        kind: 'choice',
        prompt: 'Was ergibt $(-2)·(-4)$?',
        options: [
          { text: '$-8$', feedback: 'Minus mal Minus ergibt Plus.' },
          { text: '$8$', correct: true },
          { text: '$-6$', feedback: 'Hier wird multipliziert, nicht addiert.' },
        ],
        explanation: 'Minus mal Minus ergibt Plus: $(-2)·(-4) = 8$.',
      },
    },
    {
      id: 'selbst-ausmultiplizieren',
      title: 'Jetzt du',
      body: ['Wende die Regel selbst an.'],
      question: {
        kind: 'term',
        prompt: 'Multipliziere aus und fasse zusammen:',
        term: '(x+2)(x+4)',
        answer: 'x^2+6x+8',
        form: { kind: 'expanded' },
        explanation: 'Die vier Produkte sind $x^2$, $4x$, $2x$ und $8$; zusammengefasst $x^2+6x+8$.',
      },
    },
    {
      id: 'ausklammern',
      title: 'Rückwärts',
      body: ['Ausklammern ist Ausmultiplizieren rückwärts.'],
      question: {
        kind: 'term',
        prompt: 'Klammere den größten gemeinsamen Faktor aus:',
        term: '6x^2+9x',
        answer: '3x(2x+3)',
        form: { kind: 'factored', sumFactors: 1 },
        explanation: 'Beide Summanden enthalten $3x$: $6x^2+9x = 3x(2x+3)$.',
      },
    },
  ],
}
