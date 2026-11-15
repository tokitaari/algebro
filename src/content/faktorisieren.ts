import { buildBinomialFactorTask, buildCommonFactorTask, buildCommonThenBinomialTask } from '../math'
import { poly } from './poly'
import type { TopicContent } from './types'

/** Subtopic 3: factoring by taking out a common factor and with binomial formulas backwards. */
export const faktorisieren: TopicContent = {
  sections: [
    {
      heading: 'Worum geht es?',
      paragraphs: [
        'Faktorisieren ist die Umkehrung des Ausmultiplizierens: Aus einer Summe wird ein Produkt, zum Beispiel $x^2+6x+9 = (x+3)^2$. Produkte brauchst du später oft, etwa beim Lösen von Gleichungen oder beim Kürzen.',
      ],
    },
    {
      heading: 'Ausklammern',
      paragraphs: [
        'Suche den größten Faktor, der in allen Summanden steckt, aus Zahl und Variable. In $6x^2+9x$ steckt in beiden Summanden die Zahl $3$ und die Variable $x$, zusammen also $3x$.',
        'Schreib diesen Faktor vor die Klammer. In die Klammer kommt, was übrig bleibt, wenn du jeden Summanden durch den Faktor teilst: $6x^2+9x = 3x(2x+3)$.',
      ],
    },
    {
      heading: 'Binomische Formeln rückwärts',
      paragraphs: [
        'Hat der Term drei Summanden und sind zwei davon Quadrate, prüfe die 1. oder 2. binomische Formel. In $x^2-10x+25$ sind $x^2$ und $25$ die Quadrate von $x$ und $5$. Das mittlere Glied passt: $2·x·5 = 10x$. Wegen des Minuszeichens ist es die 2. Formel: $x^2-10x+25 = (x-5)^2$.',
        'Ist der Term eine Differenz von zwei Quadraten, hilft die 3. Formel: $4x^2-9 = (2x+3)(2x-3)$.',
      ],
    },
    {
      heading: 'So gehst du vor',
      paragraphs: ['Faktorisiere immer so weit wie möglich. Diese Reihenfolge hilft:'],
      steps: [
        'Zuerst den größten gemeinsamen Faktor ausklammern, falls es einen gibt.',
        'Dann prüfen, ob in der Klammer eine binomische Formel steckt.',
        'Zur Kontrolle ausmultiplizieren: Es muss wieder der Ausgangsterm herauskommen.',
      ],
    },
  ],
  pitfalls: [
    'Vollständig faktorisieren: $2x^2+12x+18 = 2(x^2+6x+9)$ stimmt, ist aber noch nicht fertig. In der Klammer steckt noch $(x+3)^2$.',
    'Eine Summe von zwei Quadraten wie $x^2+9$ lässt sich nicht mit einer binomischen Formel zerlegen, nur eine Differenz wie $x^2-9$.',
  ],
  examples: [
    {
      title: 'Ausklammern',
      task: buildCommonFactorTask(poly('3x'), poly('2x+3')),
    },
    {
      title: '2. binomische Formel rückwärts',
      task: buildBinomialFactorTask('minus', { a: poly('x'), b: poly('5') }),
    },
    {
      title: '3. binomische Formel rückwärts',
      task: buildBinomialFactorTask('conjugate', { a: poly('2x'), b: poly('3') }),
      comment: 'Die Reihenfolge der Klammern ist egal: $(2x-3)(2x+3)$ ist genauso richtig.',
    },
    {
      title: 'Erst ausklammern, dann binomische Formel',
      task: buildCommonThenBinomialTask(2, 'plus', { a: poly('x'), b: poly('3') }),
      comment: 'Zur Kontrolle: $2(x+3)^2 = 2(x^2+6x+9) = 2x^2+12x+18$.',
    },
  ],
  formulaIds: ['common-factor', 'binomial-1-backwards', 'binomial-2-backwards', 'binomial-3-backwards'],
}
