import { useLayoutEffect, useRef, type RefObject } from 'react'

interface MathInputProps {
  id: string
  value: string
  onChange: (value: string) => void
  /** Variable letters of the current task; each gets its own key. */
  variables: readonly string[]
  readOnly?: boolean
  inputRef: RefObject<HTMLInputElement | null>
  describedBy?: string
}

interface Key {
  /** Text inserted at the caret. */
  text: string
  /** Accessible name for symbols that screen readers would read badly. */
  label?: string
}

const SYMBOL_KEYS: readonly Key[] = [
  { text: '²', label: 'Hoch zwei' },
  { text: '(', label: 'Klammer auf' },
  { text: ')', label: 'Klammer zu' },
  { text: '+', label: 'Plus' },
  { text: '−', label: 'Minus' },
  { text: '·', label: 'Malpunkt' },
]

/**
 * Text field for terms with a key row for characters that are awkward on a
 * phone keyboard (², brackets, ·). Keys insert at the caret and keep the focus
 * in the field, so the on-screen keyboard stays open.
 */
export default function MathInput({ id, value, onChange, variables, readOnly = false, inputRef, describedBy }: MathInputProps) {
  // Caret position to restore after React has written the new value.
  const caret = useRef<number | null>(null)

  useLayoutEffect(() => {
    const input = inputRef.current
    if (caret.current === null || !input) return
    input.focus()
    input.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [value, inputRef])

  const selection = () => {
    const input = inputRef.current
    const start = input?.selectionStart ?? value.length
    return { start, end: input?.selectionEnd ?? start }
  }

  const insert = (text: string) => {
    const { start, end } = selection()
    caret.current = start + text.length
    onChange(value.slice(0, start) + text + value.slice(end))
  }

  const backspace = () => {
    const { start, end } = selection()
    const from = start === end ? Math.max(0, start - 1) : start
    caret.current = from
    onChange(value.slice(0, from) + value.slice(end))
  }

  const keys: readonly Key[] = [...variables.map((v) => ({ text: v })), ...SYMBOL_KEYS]

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        className="math-input"
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="go"
      />
      <div className="math-keys" role="group" aria-label="Mathe-Tasten">
        {keys.map((key) => (
          <button
            key={key.text}
            type="button"
            className="math-key"
            aria-label={key.label}
            disabled={readOnly}
            // Keeps the focus (and on phones the keyboard) in the input.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(key.text)}
          >
            {key.text}
          </button>
        ))}
        <button
          type="button"
          className="math-key"
          aria-label="Letztes Zeichen löschen"
          disabled={readOnly}
          onMouseDown={(e) => e.preventDefault()}
          onClick={backspace}
        >
          ⌫
        </button>
      </div>
    </>
  )
}
