import { buildBinomialTask } from '../math'
import { poly } from './poly'
import type { TopicContent } from './types'

/** Subtopic 2: the three binomial formulas. */
export const binomischeFormeln: TopicContent = {
  sections: [
    {
      heading: 'Worum geht es?',
      paragraphs: [
        'Manche Produkte kommen so oft vor, dass es für sie eigene Formeln gibt: die drei binomischen Formeln. Mit ihnen geht das Ausmultiplizieren schneller als mit „jeder mit jedem“.',
      ],
    },
    {
      heading: 'Die drei Formeln',
      paragraphs: [
        '1. binomische Formel: $(a+b)^2 = a^2+2ab+b^2$',
        '2. binomische Formel: $(a-b)^2 = a^2-2ab+b^2$',
        '3. binomische Formel: $(a+b)(a-b) = a^2-b^2$',
        'Woher kommt das $2ab$? Schreib das Quadrat als Produkt und multipliziere aus: $(a+b)^2 = (a+b)(a+b) = a^2+ab+ab+b^2$. Das Produkt $ab$ entsteht zweimal.',
      ],
    },
    {
      heading: 'So wendest du sie an',
      paragraphs: [
        'Überlege zuerst, welche Formel passt und was in der Formel für $a$ und was für $b$ steht. In $(3x-2)^2$ steht $3x$ für $a$ und $2$ für $b$; es passt die 2. binomische Formel.',
        'Setze dann ein und rechne Potenzen und Produkte aus. Steht vor der Variable eine Zahl, wird beides quadriert: $(3x)^2 = 9x^2$.',
      ],
      steps: [
        'Passende Formel wählen und erkennen, was für $a$ und $b$ steht.',
        'In die Formel einsetzen.',
        'Potenzen und Produkte ausrechnen.',
      ],
    },
    {
      heading: 'Die dritte Formel',
      paragraphs: [
        'Bei $(a+b)(a-b)$ heben sich die gemischten Produkte $ab$ und $-ab$ gegenseitig auf. Deshalb bleiben nur zwei Quadrate übrig, zum Beispiel $(x+5)(x-5) = x^2-25$.',
      ],
    },
  ],
  pitfalls: [
    'Das mittlere Glied nicht vergessen: $(a+b)^2 ≠ a^2+b^2$.',
    'Bei der 2. binomischen Formel ist nur das mittlere Glied negativ; $b^2$ ist immer positiv: $(x-3)^2 = x^2-6x+9$.',
  ],
  examples: [
    {
      title: '1. binomische Formel',
      task: buildBinomialTask('plus', { a: poly('x'), b: poly('4') }),
    },
    {
      title: '2. binomische Formel mit Koeffizient',
      task: buildBinomialTask('minus', { a: poly('3x'), b: poly('2') }),
      comment: 'Hier steht $3x$ für $a$. Deshalb wird die ganze Klammer quadriert: $(3x)^2 = 9x^2$.',
    },
    {
      title: '3. binomische Formel',
      task: buildBinomialTask('conjugate', { a: poly('x'), b: poly('5') }),
    },
  ],
  formulaIds: ['binomial-1', 'binomial-2', 'binomial-3', 'square-product'],
}
