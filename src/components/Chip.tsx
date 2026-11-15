/** One check result as a pill: "✓ äquivalent", "✗ Form nicht ok". The glyph backs up the colour. */
export default function Chip({ ok, children }: { ok: boolean; children: string }) {
  return (
    <span className={ok ? 'chip chip-ok' : 'chip chip-bad'}>
      <span aria-hidden="true">{ok ? '✓' : '✗'}</span> {children}
    </span>
  )
}
