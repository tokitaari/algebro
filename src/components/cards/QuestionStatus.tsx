import type { Markup } from '../../content'
import type { QuestionState } from '../../cards'
import { toLatex } from '../../math'
import Chip from '../Chip'
import InputEcho from '../InputEcho'
import RichText from '../RichText'
import Tex from '../Tex'

interface QuestionStatusProps {
  state: QuestionState
  /** Text of the wrong option that was picked, if it has one. */
  wrongChoiceFeedback?: Markup
  /** Term questions: show the checks ("äquivalent", "Form ok") as chips on success, like the practice area. */
  showChecks?: boolean
}

/**
 * Feedback of a question in a live region, so screen readers announce it.
 * The region is always rendered; only its content changes.
 */
export default function QuestionStatus({ state, wrongChoiceFeedback, showChecks = false }: QuestionStatusProps) {
  return (
    <div role="status" className="practice-feedback-region">
      <Message state={state} wrongChoiceFeedback={wrongChoiceFeedback} showChecks={showChecks} />
    </div>
  )
}

function Message({ state, wrongChoiceFeedback, showChecks }: QuestionStatusProps) {
  const feedback = state.feedback
  if (!feedback) {
    // After a reload only the resolution is known.
    if (state.resolved === 'correct') return <p className="feedback feedback-correct">✓ Schon gelöst.</p>
    if (state.resolved === 'revealed') return <p className="feedback feedback-wrong">Lösung schon angesehen.</p>
    return null
  }
  switch (feedback.kind) {
    case 'correct':
      return (
        <div className="feedback feedback-correct">
          <p>✓ Richtig!</p>
          {showChecks && (
            <div className="chips">
              <Chip ok>äquivalent</Chip>
              <Chip ok>Form ok</Chip>
            </div>
          )}
        </div>
      )
    case 'revealed':
      return <p className="feedback feedback-wrong">Hier ist die Lösung. Lies sie dir in Ruhe durch.</p>
    case 'wrong-choice':
      return (
        <div className="feedback feedback-wrong">
          <p>✗ Leider nicht. Versuch es noch einmal.</p>
          {wrongChoiceFeedback && (
            <p>
              <RichText text={wrongChoiceFeedback} />
            </p>
          )}
        </div>
      )
    case 'wrong':
      return (
        <div className="feedback feedback-wrong">
          <p>✗ Noch nicht. Dein Term ist nicht gleichwertig. Versuch es noch einmal.</p>
          <div className="chips">
            <Chip ok={false}>nicht äquivalent</Chip>
          </div>
          {feedback.answer && (
            <p className="feedback-answer">
              Deine Antwort: <Tex latex={toLatex(feedback.answer)} />
            </p>
          )}
        </div>
      )
    case 'wrong-form':
      return (
        <div className="feedback feedback-form">
          <p>Fast: Dein Term ist gleichwertig, aber noch nicht in der gewünschten Form.</p>
          <div className="chips">
            <Chip ok>äquivalent</Chip>
            <Chip ok={false}>Form nicht ok</Chip>
          </div>
          <p>{feedback.hint.message}</p>
        </div>
      )
    case 'invalid':
      return (
        <div className="feedback feedback-invalid">
          <p>Das kann ich nicht lesen. {feedback.error.message}</p>
          {feedback.input.trim() !== '' && (
            <InputEcho input={feedback.input} position={feedback.error.position} length={feedback.error.length} />
          )}
        </div>
      )
  }
}
