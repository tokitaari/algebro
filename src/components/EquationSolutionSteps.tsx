import { equationToLatex, operationToLatex, solutionSetToLatex, type EquationTask } from '../math'
import Tex from './Tex'

/**
 * Worked solution of an equation in school notation: one line per equation,
 * the operation that leads to the next line written next to it, and the
 * solution set as the result. Used for the worked examples and later for the
 * model solution in the practice area.
 */
export default function EquationSolutionSteps({ task }: { task: EquationTask }) {
  const lines = [task.equation, ...task.steps.map((step) => step.equation)]
  return (
    <ol className="solution" aria-label="Lösungsweg">
      {lines.map((equation, i) => {
        const next = task.steps[i]
        return (
          <li key={i} className="solution-step">
            <span className="solution-rel" aria-hidden="true" />
            <span className="solution-expr">
              <Tex latex={equationToLatex(equation)} />
            </span>
            {next && (
              <span className="solution-note equation-op">
                <Tex latex={operationToLatex(next.operation)} />
                {next.note && <span className="equation-op-note">{next.note}</span>}
              </span>
            )}
          </li>
        )
      })}
      <li className="solution-step solution-result">
        <span className="solution-rel" aria-hidden="true" />
        <span className="solution-expr">
          <Tex latex={solutionSetToLatex(task.solutionSet)} />
        </span>
        <span className="solution-note">{task.solutionNote}</span>
      </li>
    </ol>
  )
}
