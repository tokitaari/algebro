import type { Expr } from '../ast'
import type { AnswerKey } from '../check'
import type { Rng } from '../random'

/** Subtopics of unit 1; identical to the route slugs in src/topics.ts. */
export type TopicId = 'ausmultiplizieren' | 'binomische-formeln' | 'faktorisieren'

export const TOPIC_IDS: readonly TopicId[] = ['ausmultiplizieren', 'binomische-formeln', 'faktorisieren']

/** One line of a worked solution: `previous = expr`, optionally explained by `note` (German). */
export interface SolutionStep {
  expr: Expr
  note?: string
}

export interface Task extends AnswerKey {
  topic: TopicId
  /** Generator variant, e.g. "square-plus"; useful for tests and later statistics. */
  variant: string
  /** Identity of the exercise (the printed prompt); used to avoid repetitions. */
  key: string
  /** German instruction, e.g. "Multipliziere aus und fasse zusammen." */
  instruction: string
  /** The term to transform. */
  prompt: Expr
  /** Worked solution from the prompt to `solution`; every step is equivalent to the prompt. */
  steps: SolutionStep[]
  /** Model answer (the last step). */
  solution: Expr
}

export type TaskGenerator = (rng: Rng) => Task
