import { useId, useRef, useState, type FormEvent } from 'react'
import type { QuestionState, TermQuestion } from '../../cards'
import { termToLatex } from '../../content'
import { taskVariables } from '../../practice/session'
import MathInput from '../MathInput'
import RichText from '../RichText'
import Tex from '../Tex'
import QuestionStatus from './QuestionStatus'

interface TermQuestionViewProps {
  question: TermQuestion
  state: QuestionState
  canReveal: boolean
  onAnswer: (input: string) => void
  onReveal: () => void
}

/**
 * Free term input with the math keys of the practice area, checked with
 * `checkAnswer`. Wrong answers may be corrected; once solved or revealed,
 * the model answer and the explanation are shown.
 */
export default function TermQuestionView({ question, state, canReveal, onAnswer, onReveal }: TermQuestionViewProps) {
  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState('')
  const resolved = state.resolved !== null

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    onAnswer(input)
    // Unless the answer was right (then the deck moves the focus on), stay in the field for the next try.
    inputRef.current?.focus()
  }

  return (
    <div className="question">
      <p className="question-prompt">
        <RichText text={question.prompt} />
      </p>
      {question.term && <Tex latex={termToLatex(question.term)} display />}

      <form onSubmit={onSubmit} noValidate>
        <label htmlFor={inputId} className="practice-label">
          Deine Antwort
        </label>
        <MathInput
          id={inputId}
          value={input}
          onChange={setInput}
          variables={question.variables ?? taskVariables(`${question.answer} ${question.term ?? ''}`)}
          readOnly={resolved}
          inputRef={inputRef}
          describedBy={hintId}
        />
        <p id={hintId} className="practice-hint">
          Tipp: x² geht auch als x^2, und 2x oder 3(x+1) darfst du ohne Malzeichen tippen.
        </p>
        {!resolved && (
          <div className="practice-actions">
            <button type="submit" className="btn btn-primary">
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

      <QuestionStatus state={state} showChecks />

      {resolved && (
        <div className="question-explanation">
          <p>
            Musterlösung: <Tex latex={termToLatex(question.answer)} />
          </p>
          {question.explanation && (
            <p>
              <RichText text={question.explanation} />
            </p>
          )}
        </div>
      )}
    </div>
  )
}
