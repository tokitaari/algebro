import { EQUATION_TOPIC_IDS } from './equations'
import { TOPIC_IDS } from './tasks'

/**
 * Both registers of subtopics: term tasks (`generators`, `TOPIC_IDS`) and
 * equation tasks (`equationGenerators`, `EQUATION_TOPIC_IDS`). They stay
 * apart because an equation is solved line by line and has no single term as
 * its answer; everything that covers all subtopics (catalog test, stored
 * progress) uses this list.
 */
export const ALL_TOPIC_IDS = [...TOPIC_IDS, ...EQUATION_TOPIC_IDS]

export type TermTopicId = (typeof TOPIC_IDS)[number]
export type EquationTopicId = (typeof EQUATION_TOPIC_IDS)[number]
export type AnyTopicId = TermTopicId | EquationTopicId

/** True for a subtopic whose tasks are terms (see `generators`). */
export function isTermTopic(id: string): id is TermTopicId {
  return (TOPIC_IDS as readonly string[]).includes(id)
}

/** True for a subtopic whose tasks are linear equations (see `equationGenerators`). */
export function isEquationTopic(id: string): id is EquationTopicId {
  return (EQUATION_TOPIC_IDS as readonly string[]).includes(id)
}
