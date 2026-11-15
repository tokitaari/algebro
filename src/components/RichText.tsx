import { Fragment } from 'react'
import { chainPieces, splitMarkup } from '../content'
import Tex from './Tex'

/**
 * Text with `$…$` terms (see src/content/markup.ts), rendered inline. A chain
 * such as `a = b = c` may wrap before a relation sign, but never inside a term.
 */
export default function RichText({ text }: { text: string }) {
  return (
    <>
      {splitMarkup(text).map((segment, i) =>
        segment.kind === 'text' ? (
          segment.text
        ) : (
          <Fragment key={i}>
            {chainPieces(segment.source).map((latex, j) => (
              <Fragment key={j}>
                {j > 0 && ' '}
                <Tex latex={latex} />
              </Fragment>
            ))}
          </Fragment>
        ),
      )}
    </>
  )
}
