import type { WorkedExample } from '../content'
import RichText from './RichText'
import SolutionSteps from './SolutionSteps'

interface WorkedExampleCardProps {
  example: WorkedExample
  number: number
}

export default function WorkedExampleCard({ example, number }: WorkedExampleCardProps) {
  const headingId = `beispiel-${number}`
  return (
    <article className="example" aria-labelledby={headingId}>
      <h3 id={headingId}>
        Beispiel {number}: {example.title}
      </h3>
      <p className="example-instruction">{example.task.instruction}</p>
      <SolutionSteps task={example.task} />
      {example.comment && (
        <p className="example-comment">
          <RichText text={example.comment} />
        </p>
      )}
    </article>
  )
}
