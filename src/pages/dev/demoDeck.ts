import type { Deck } from '../../cards'

/**
 * Demo deck for the card framework, shown at /dev/karten in the dev server
 * only. It uses every card feature at least once, including the three modes
 * of the area model; real decks arrive with the subtopics.
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
      id: 'flaechenmodell',
      title: 'Als Fläche',
      body: [
        'Ein Produkt aus zwei Klammern ist die Fläche eines Rechtecks: Die Summanden teilen die Seiten auf, jede Teilfläche ist ein Produkt.',
        'Ein negativer Summand ist ein Streifen, der am Ende der Seite abgeschnitten wird.',
      ],
      widget: { kind: 'area-model', first: ['x', '3'], second: ['x', '-5'], mode: 'expand' },
    },
    {
      id: 'dritte-binomische-formel',
      title: 'Was sich aufhebt',
      body: ['Dieses Rechteck ist maßstabsgetreu gezeichnet, mit der Länge 5 für $a$ und 2 für $b$.'],
      widget: { kind: 'area-model', first: ['a', 'b'], second: ['a', '-b'], mode: 'expand', lengths: { a: { value: 5 }, b: { value: 2 } } },
      question: {
        kind: 'choice',
        prompt: 'Welche Teilflächen heben sich bei $(a+b)(a-b)$ auf?',
        options: [
          { text: '$a^2$ und $-b^2$', feedback: 'Diese beiden bleiben übrig: $(a+b)(a-b) = a^2-b^2$.' },
          { text: '$-ab$ und $ab$', correct: true },
        ],
        explanation: 'Der Streifen $-ab$ nimmt genau so viel weg, wie die Teilfläche $ab$ dazugibt.',
      },
    },
    {
      id: 'quadrat-ziehen',
      title: 'Ziehen und prüfen',
      body: [
        'Ziehe die Punkte an den Kanten. Die Formel $(a-b)^2 = a^2-2ab+b^2$ stimmt für jede Länge.',
        'Mit der Tastatur: Punkt mit Tab wählen, dann die Pfeiltasten.',
      ],
      widget: {
        kind: 'area-model',
        first: ['a', '-b'],
        second: ['a', '-b'],
        mode: 'explore',
        lengths: { a: { value: 6, min: 4, max: 9 }, b: { value: 2, min: 1, max: 3 } },
      },
    },
    {
      id: 'flaeche-rueckwaerts',
      title: 'Rückwärts gedacht',
      body: ['Die Teilflächen sind gegeben. Welche Seiten hat das Rechteck?'],
      widget: { kind: 'area-model', first: ['x', '3'], second: ['x', '3'], mode: 'factor' },
      question: {
        kind: 'term',
        prompt: 'Schreibe als Produkt:',
        term: 'x^2+6x+9',
        answer: '(x+3)^2',
        form: { kind: 'factored', sumFactors: 2 },
        explanation: 'Beide Seiten sind $x+3$: $x^2+6x+9 = (x+3)^2$.',
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
