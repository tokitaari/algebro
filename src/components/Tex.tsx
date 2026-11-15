import katex from 'katex'
import { useMemo } from 'react'

interface TexProps {
  /** LaTeX source, e.g. from `toLatex`. */
  latex: string
  /** Display mode: centred block with larger operators. Default: inline. */
  display?: boolean
}

/**
 * Typesets LaTeX with KaTeX. KaTeX also emits MathML, so screen readers can
 * read the formula. Rendering happens locally; no fonts or scripts are loaded
 * from external servers.
 */
export default function Tex({ latex, display = false }: TexProps) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        displayMode: display,
        // Content is checked in tests with throwOnError; at runtime a broken
        // formula is shown as source text instead of breaking the page.
        throwOnError: false,
        output: 'htmlAndMathml',
      }),
    [latex, display],
  )
  const Tag = display ? 'div' : 'span'
  return <Tag className={display ? 'tex tex-display' : 'tex'} dangerouslySetInnerHTML={{ __html: html }} />
}
