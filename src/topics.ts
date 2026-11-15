export interface Topic {
  /** URL segment, e.g. "/ausmultiplizieren" */
  slug: string
  title: string
  summary: string
}

/** The three subtopics of unit 1 (terms and binomial formulas). */
export const topics: readonly Topic[] = [
  {
    slug: 'ausmultiplizieren',
    title: 'Klammern ausmultiplizieren',
    summary: 'Summe mal Summe: jeden Summanden mit jedem multiplizieren.',
  },
  {
    slug: 'binomische-formeln',
    title: 'Binomische Formeln',
    summary: 'Die drei binomischen Formeln erkennen und anwenden.',
  },
  {
    slug: 'faktorisieren',
    title: 'Faktorisieren',
    summary: 'Ausklammern und binomische Formeln rückwärts nutzen.',
  },
]

export function findTopic(slug: string | undefined): Topic | undefined {
  return topics.find((t) => t.slug === slug)
}
