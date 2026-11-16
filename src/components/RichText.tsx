import { Fragment } from 'react'
import { segmentPieces, splitMarkup } from '../content'
import Tex from './Tex'

/**
 * Text with `$…$` terms and `$eq: …$` equations (see src/content/markup.ts),
 * rendered inline. A chain such as `a = b = c` may wrap before a relation
 * sign and an equation before `=` or its operation, but never inside a term.
 */
export default function RichText({ text }: { text: string }) {
  return (
    <>
      {splitMarkup(text).map((segment, i) =>
        segment.kind === 'text' ? (
          segment.text
        ) : (
          <Fragment key={i}>
            {segmentPieces(segment).map((latex, j) => (
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
