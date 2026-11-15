import { useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { generateSeries, toLatex, toText, type Rng, type TopicId } from '../math'
import {
  countCorrect,
  createSession,
  currentTask,
  finishedBetween,
  isSeriesOver,
  isTaskFinished,
  nextTask,
  revealSolution,
  submitAnswer,
  taskVariables,
  type Feedback,
  type Session,
} from '../practice/session'
import { useTopicProgress } from '../practice/useTopicProgress'
import MathInput from './MathInput'
import SkillPath from './SkillPath'
import SolutionSteps from './SolutionSteps'
import Tex from './Tex'

interface PracticeProps {
  topic: TopicId
  /** Source of randomness for the series; tests pass a seeded one. */
  rng?: Rng
}

/**
 * Practice area of a subtopic: a series of generated tasks, one at a time,
 * with feedback, model solution and progress that is kept in the browser.
 */
export default function Practice({ topic, rng = Math.random }: PracticeProps) {
  const [session, setSession] = useState(() => createSession(generateSeries(topic, rng)))
  const [input, setInput] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const { progress, saveFailed, record, reset } = useTopicProgress(topic)

  const inputId = useId()
  const hintId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const solutionRef = useRef<HTMLHeadingElement>(null)
  const summaryRef = useRef<HTMLHeadingElement>(null)
  // Set by handlers that start a new task; the effect below moves the focus once it is rendered.
  const focusInput = useRef(false)

  const task = currentTask(session)
  const finished = isTaskFinished(session)
  const over = isSeriesOver(session)

  useEffect(() => {
    if (focusInput.current) {
      focusInput.current = false
      inputRef.current?.focus()
    }
  }, [session])

  // Screen readers and small screens land on the model solution right after the check.
  useEffect(() => {
    if (finished) solutionRef.current?.focus()
  }, [finished])

  useEffect(() => {
    if (over) summaryRef.current?.focus()
  }, [over])

  const apply = (next: Session) => {
    const done = finishedBetween(session, next)
    setSession(next)
    if (done) record(done.correct, done.series)
    else inputRef.current?.focus()
  }

  const startSeries = () => {
    focusInput.current = true
    setSession(createSession(generateSeries(topic, rng)))
    setInput('')
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    apply(submitAnswer(session, input))
  }

  const onNext = () => {
    focusInput.current = true
    setSession(nextTask(session))
    setInput('')
  }

  const onReset = () => {
    reset()
    setConfirmReset(false)
    startSeries()
  }

  return (
    <section aria-labelledby="uebung" className="panel practice">
      <h2 id="uebung">Übung</h2>

      <div className="practice-progress">
        <p>
          {progress.answered === 0
            ? 'Noch keine Aufgabe gelöst.'
            : `Bisher: ${progress.correct} von ${progress.answered} richtig.`}
          {progress.lastSeries &&
            ` Letzte Serie: ${progress.lastSeries.correct} von ${progress.lastSeries.total} richtig.`}
        </p>
        {saveFailed && (
          <p className="practice-warning" role="alert">
            Dein Browser erlaubt kein Speichern. Der Fortschritt geht beim Neuladen verloren.
          </p>
        )}
        {progress.answered > 0 &&
          (confirmReset ? (
            <p className="practice-confirm">
              Fortschritt in diesem Teilthema löschen und eine neue Serie beginnen?{' '}
              <button type="button" className="btn btn-danger" onClick={onReset}>
                Ja, zurücksetzen
              </button>{' '}
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(false)}>
                Abbrechen
              </button>
            </p>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(true)}>
              Fortschritt zurücksetzen
            </button>
          ))}
      </div>

      {over || !task ? (
        <SeriesSummary session={session} summaryRef={summaryRef} onRestart={startSeries} />
      ) : (
        <div className="practice-task">
          <SkillPath
            total={session.tasks.length}
            outcomes={session.outcomes}
            current={session.index}
            label="Fortschritt in dieser Serie"
          />
          <p className="practice-counter">
            Aufgabe {session.index + 1} von {session.tasks.length}
          </p>
          <p className="example-instruction">{task.instruction}</p>
          <Tex latex={toLatex(task.prompt)} display />

          <form onSubmit={onSubmit} noValidate>
            <label htmlFor={inputId} className="practice-label">
              Deine Antwort
            </label>
            <MathInput
              id={inputId}
              value={input}
              onChange={setInput}
              variables={taskVariables(toText(task.prompt))}
              readOnly={finished}
              inputRef={inputRef}
              describedBy={hintId}
            />
            <p id={hintId} className="practice-hint">
              Tipp: x² geht auch als x^2, und 2x oder 3(x+1) darfst du ohne Malzeichen tippen.
            </p>
            <div className="practice-actions">
              <button type="submit" className="btn btn-primary" disabled={finished}>
                Prüfen
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={finished}
                onClick={() => apply(revealSolution(session))}
              >
                Lösung anzeigen
              </button>
            </div>
          </form>

          <div role="status" className="practice-feedback-region">
            {session.feedback && <FeedbackMessage feedback={session.feedback} />}
          </div>

          {finished && (
            <section aria-labelledby={`${inputId}-musterloesung`} className="practice-solution">
              <h3 id={`${inputId}-musterloesung`} ref={solutionRef} tabIndex={-1}>
                Musterlösung
              </h3>
              <SolutionSteps task={task} />
              <button type="button" className="btn btn-primary" onClick={onNext}>
                {session.index + 1 < session.tasks.length ? 'Nächste Aufgabe' : 'Ergebnis ansehen'}
              </button>
            </section>
          )}
        </div>
      )}
    </section>
  )
}

/** One check result as a pill: "✓ äquivalent", "✗ Form nicht ok". The glyph backs up the colour. */
function Chip({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span className={ok ? 'chip chip-ok' : 'chip chip-bad'}>
      <span aria-hidden="true">{ok ? '✓' : '✗'}</span> {children}
    </span>
  )
}

function FeedbackMessage({ feedback }: { feedback: Feedback }) {
  switch (feedback.kind) {
    case 'correct':
      return (
        <div className="feedback feedback-correct">
          <p>✓ Richtig!</p>
          <div className="chips">
            <Chip ok>äquivalent</Chip>
            <Chip ok>Form ok</Chip>
          </div>
        </div>
      )
    case 'wrong':
      return (
        <div className="feedback feedback-wrong">
          <p>✗ Leider falsch. Dein Term ist nicht gleichwertig zur Aufgabe.</p>
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
    case 'revealed':
      return <p className="feedback feedback-wrong">Hier ist die Musterlösung. Die Aufgabe zählt als nicht gelöst.</p>
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
          {feedback.input.trim() !== '' && <InputEcho input={feedback.input} position={feedback.error.position} length={feedback.error.length} />}
        </div>
      )
  }
}

/** Shows the input with the faulty part marked (not by colour alone: the marked part is also underlined). */
function InputEcho({ input, position, length }: { input: string; position: number; length: number }) {
  const start = Math.min(Math.max(position, 0), input.length)
  const end = Math.min(start + Math.max(length, 1), input.length)
  return (
    <p className="input-echo">
      <code>
        {input.slice(0, start)}
        <mark>{input.slice(start, end) || '␣'}</mark>
        {input.slice(end)}
      </code>
    </p>
  )
}

function SeriesSummary({
  session,
  summaryRef,
  onRestart,
}: {
  session: Session
  summaryRef: RefObject<HTMLHeadingElement | null>
  onRestart: () => void
}) {
  const total = session.tasks.length
  return (
    <div className="practice-summary">
      <h3 ref={summaryRef} tabIndex={-1}>
        Serie geschafft: {countCorrect(session)} von {total} richtig
      </h3>
      <SkillPath total={total} outcomes={session.outcomes} label="Ergebnis je Aufgabe" />
      <button type="button" className="btn btn-primary" onClick={onRestart}>
        Neue Serie
      </button>
    </div>
  )
}
