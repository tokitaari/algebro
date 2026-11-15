/** Shows the input with the faulty part marked (not by colour alone: the marked part is also underlined). */
export default function InputEcho({ input, position, length }: { input: string; position: number; length: number }) {
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
