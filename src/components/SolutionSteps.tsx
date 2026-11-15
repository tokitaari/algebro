import { toLatex, type Task } from '../math'
import Tex from './Tex'

interface SolutionStepsProps {
  task: Task
}

/**
 * Worked solution of a task: the prompt, then one line per step
 * (`= expression`) with its explanation. The last line is the result.
 * Used for the worked examples and for the model solution in the practice area.
 */
export default function SolutionSteps({ task }: SolutionStepsProps) {
  const last = task.steps.length - 1
  return (
    <ol className="solution" aria-label="Lösungsweg">
      <li className="solution-step">
        <span className="solution-rel" aria-hidden="true" />
        <span className="solution-expr">
          <Tex latex={toLatex(task.prompt)} />
        </span>
      </li>
      {task.steps.map((step, i) => (
        <li key={i} className={i === last ? 'solution-step solution-result' : 'solution-step'}>
          <span className="solution-rel">
            <Tex latex="=" />
          </span>
          <span className="solution-expr">
            <Tex latex={toLatex(step.expr)} />
          </span>
          {step.note && <span className="solution-note">{step.note}</span>}
        </li>
      ))}
    </ol>
  )
}
