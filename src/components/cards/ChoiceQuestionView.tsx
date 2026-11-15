import { useId, useState, type FormEvent } from 'react'
import { correctOption, type ChoiceQuestion, type QuestionState } from '../../cards'
import RichText from '../RichText'
import QuestionStatus from './QuestionStatus'

interface ChoiceQuestionViewProps {
  question: ChoiceQuestion
  state: QuestionState
  canReveal: boolean
  onAnswer: (option: number) => void
  onReveal: () => void
}

/**
 * Single choice as a radio group in a fieldset (arrow keys move between the
 * options natively). After solving or revealing, the correct option is
 * marked with a glyph and a text, not by colour alone.
 */
export default function ChoiceQuestionView({ question, state, canReveal, onAnswer, onReveal }: ChoiceQuestionViewProps) {
  const name = useId()
  const [selected, setSelected] = useState<number | null>(null)
  const resolved = state.resolved !== null
  const correct = correctOption(question.options)
  const wrongPick = state.feedback?.kind === 'wrong-choice' ? state.feedback.option : null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (selected !== null) onAnswer(selected)
  }

  return (
    <div className="question">
      <form onSubmit={onSubmit} noValidate>
        <fieldset className="choice" disabled={resolved}>
          <legend className="question-prompt">
            <RichText text={question.prompt} />
          </legend>
          <div className="choice-options">
            {question.options.map((option, i) => {
              const mark = resolved && i === correct ? 'right' : !resolved && i === wrongPick ? 'wrong' : null
              return (
                <label key={i} className={mark ? `choice-option choice-${mark}` : 'choice-option'}>
                  <input
                    type="radio"
                    name={name}
                    value={i}
                    checked={selected === i || (resolved && selected === null && i === correct)}
                    onChange={() => setSelected(i)}
                  />
                  <span className="choice-text">
                    <RichText text={option.text} />
                  </span>
                  {mark && (
                    <span className="choice-mark">
                      <span aria-hidden="true">{mark === 'right' ? '✓' : '✗'}</span>
                      {/* Starts with a comma: the name computation drops leading spaces of an element. */}
                      <span className="visually-hidden">{mark === 'right' ? ', richtig' : ', falsch'}</span>
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </fieldset>
        {!resolved && (
          <div className="practice-actions">
            <button type="submit" className="btn btn-primary" disabled={selected === null}>
              Prüfen
            </button>
            {canReveal && (
              <button type="button" className="btn btn-secondary" onClick={onReveal}>
                Lösung anzeigen
              </button>
            )}
          </div>
        )}
      </form>

      <QuestionStatus state={state} wrongChoiceFeedback={wrongPick !== null ? question.options[wrongPick]?.feedback : undefined} />

      {resolved && question.explanation && (
        <p className="question-explanation">
          <RichText text={question.explanation} />
        </p>
      )}
    </div>
  )
}
