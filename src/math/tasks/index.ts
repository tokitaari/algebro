import type { Rng } from '../random'
import { generateBinomialTask } from './binomial'
import { generateExpandTask } from './expand'
import { generateFactorTask } from './factor'
import type { Task, TaskGenerator, TopicId } from './types'

export { TOPIC_IDS, type SolutionStep, type Task, type TaskGenerator, type TopicId } from './types'

export const generators: Readonly<Record<TopicId, TaskGenerator>> = {
  ausmultiplizieren: generateExpandTask,
  'binomische-formeln': generateBinomialTask,
  faktorisieren: generateFactorTask,
}

/** Default length of a practice series. */
export const SERIES_LENGTH = 10

const MAX_ATTEMPTS = 200

/**
 * Generates a task whose key is not in `exclude` (e.g. the keys of the
 * current series). Falls back to a repeat only if the generator keeps
 * producing excluded tasks, which does not happen for realistic sizes.
 */
export function generateTask(topic: TopicId, rng: Rng, exclude: Iterable<string> = []): Task {
  const excluded = new Set(exclude)
  const generate = generators[topic]
  let task = generate(rng)
  for (let i = 1; i < MAX_ATTEMPTS && excluded.has(task.key); i++) task = generate(rng)
  return task
}

/** A series of tasks without repetitions. */
export function generateSeries(topic: TopicId, rng: Rng, length = SERIES_LENGTH): Task[] {
  const tasks: Task[] = []
  for (let i = 0; i < length; i++) {
    tasks.push(generateTask(topic, rng, tasks.map((t) => t.key)))
  }
  return tasks
}
