import { termToLatex } from './markup'
import type { Formula, FormulaGroup } from './types'

/**
 * Formula sheet per topic, keyed by "area/topic" as in the catalog. Topics
 * without formulas have no entry. Every formula is checked for equivalence in
 * the content tests.
 */
export const formulaSheets: Readonly<Record<string, readonly FormulaGroup[]>> = {
  'algebra/terme': [
    {
      title: 'Ausmultiplizieren',
      formulas: [
        { id: 'distributive', name: 'Zahl oder Variable mal Summe', lhs: 'a(b+c)', rhs: 'ab+ac' },
        { id: 'sum-times-sum', name: 'Summe mal Summe', lhs: '(a+b)(c+d)', rhs: 'ac+ad+bc+bd' },
      ],
    },
    {
      title: 'Binomische Formeln',
      formulas: [
        { id: 'binomial-1', name: '1. binomische Formel', lhs: '(a+b)^2', rhs: 'a^2+2ab+b^2' },
        { id: 'binomial-2', name: '2. binomische Formel', lhs: '(a-b)^2', rhs: 'a^2-2ab+b^2' },
        { id: 'binomial-3', name: '3. binomische Formel', lhs: '(a+b)(a-b)', rhs: 'a^2-b^2' },
      ],
    },
    {
      title: 'Faktorisieren',
      formulas: [
        { id: 'common-factor', name: 'Ausklammern', lhs: 'ab+ac', rhs: 'a(b+c)' },
        { id: 'binomial-1-backwards', name: '1. binomische Formel rückwärts', lhs: 'a^2+2ab+b^2', rhs: '(a+b)^2' },
        { id: 'binomial-2-backwards', name: '2. binomische Formel rückwärts', lhs: 'a^2-2ab+b^2', rhs: '(a-b)^2' },
        { id: 'binomial-3-backwards', name: '3. binomische Formel rückwärts', lhs: 'a^2-b^2', rhs: '(a+b)(a-b)' },
      ],
    },
    {
      title: 'Rechenregeln',
      formulas: [
        { id: 'same-variable', name: 'Gleiche Variablen multiplizieren', lhs: 'a·a', rhs: 'a^2' },
        { id: 'square-product', name: 'Ein Produkt quadrieren', lhs: '(ab)^2', rhs: 'a^2b^2' },
        { id: 'sign-minus-plus', name: 'Minus mal Plus', lhs: '(-a)·b', rhs: '-ab' },
        { id: 'sign-minus-minus', name: 'Minus mal Minus', lhs: '(-a)·(-b)', rhs: 'ab' },
      ],
    },
  ],
}

export const allFormulas: readonly Formula[] = Object.values(formulaSheets).flatMap((groups) =>
  groups.flatMap((g) => g.formulas),
)

/** The formula groups of a topic; empty if the topic has none. */
export function formulaGroupsOf(areaSlug: string, topicSlug: string): readonly FormulaGroup[] {
  const key = `${areaSlug}/${topicSlug}`
  return Object.hasOwn(formulaSheets, key) ? formulaSheets[key]! : []
}

export function findFormula(id: string): Formula {
  const formula = allFormulas.find((f) => f.id === id)
  if (!formula) throw new Error(`Unknown formula id: ${id}`)
  return formula
}

/** LaTeX for a formula, e.g. `(a + b)^{2} = a^{2} + 2ab + b^{2}`. */
export function formulaLatex(formula: Formula): string {
  return `${termToLatex(formula.lhs)} = ${termToLatex(formula.rhs)}`
}
