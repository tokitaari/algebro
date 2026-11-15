// @vitest-environment node
import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { areEquivalent, checkAnswer, parse, toLatex, toPolynomial, toText, TOPIC_IDS } from '../math'
import { topics } from '../topics'
import { allFormulas, findContent, findFormula, formulaGroups, formulaLatex, topicContent } from './index'
import { chainToLatex, splitChain, splitMarkup } from './markup'
import type { TopicContent } from './types'

/** Every markup text of a topic: paragraphs, procedure steps, pitfalls, example comments. */
function markupTexts(content: TopicContent): string[] {
  return [
    ...content.sections.flatMap((s) => [...s.paragraphs, ...(s.steps ?? [])]),
    ...content.pitfalls,
    ...content.examples.flatMap((e) => (e.comment ? [e.comment] : [])),
  ]
}

function mathSources(text: string): string[] {
  return splitMarkup(text).flatMap((s) => (s.kind === 'math' ? [s.source] : []))
}

/** KaTeX in strict mode: unknown commands or bad syntax throw. */
function renderStrict(latex: string, displayMode = false): string {
  return katex.renderToString(latex, { throwOnError: true, strict: 'error', displayMode })
}

describe('markup', () => {
  it('splits text and math segments', () => {
    expect(splitMarkup('Aus $x·x$ wird $x^2$.')).toEqual([
      { kind: 'text', text: 'Aus ' },
      { kind: 'math', source: 'x·x' },
      { kind: 'text', text: ' wird ' },
      { kind: 'math', source: 'x^2' },
      { kind: 'text', text: '.' },
    ])
  })

  it('rejects an unbalanced dollar sign', () => {
    expect(() => splitMarkup('Kosten: 5 $')).toThrow(/Unbalanced/)
  })

  it('splits chains with = and ≠', () => {
    expect(splitChain('(a+b)^2 ≠ a^2+b^2 = x')).toEqual({
      terms: ['(a+b)^2', 'a^2+b^2', 'x'],
      relations: ['≠', '='],
    })
  })

  it('prints chains with toLatex', () => {
    expect(chainToLatex('x·x ≠ 2x')).toBe('x \\cdot x \\neq 2x')
    expect(chainToLatex('(a+b)(a-b) = a^2-b^2')).toBe('(a + b)(a - b) = a^{2} - b^{2}')
  })

  it('keeps multiplication dots written in the source', () => {
    expect(chainToLatex('3·(-5) = -15')).toBe('3 \\cdot (-5) = -15')
    expect(chainToLatex('2·x·5 = 10x')).toBe('2 \\cdot x \\cdot 5 = 10x')
    expect(chainToLatex('(-a)·b = -ab')).toBe('(-a) \\cdot b = -ab')
    expect(chainToLatex('3x(2x+3)')).toBe('3x(2x + 3)')
  })
})

describe('formula sheet', () => {
  it('has unique ids', () => {
    const ids = allFormulas.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it.each(allFormulas.map((f) => [f.name, f] as const))('%s is a true identity', (_name, formula) => {
    expect(areEquivalent(parse(formula.lhs), parse(formula.rhs))).toBe(true)
  })

  it('typesets every formula with KaTeX', () => {
    for (const formula of allFormulas) expect(() => renderStrict(formulaLatex(formula), true)).not.toThrow()
  })

  it('shows the three binomial formulas in school notation', () => {
    const latex = formulaGroups.find((g) => g.title === 'Binomische Formeln')?.formulas.map(formulaLatex)
    expect(latex).toEqual([
      '(a + b)^{2} = a^{2} + 2ab + b^{2}',
      '(a - b)^{2} = a^{2} - 2ab + b^{2}',
      '(a + b)(a - b) = a^{2} - b^{2}',
    ])
  })
})

describe('topic content', () => {
  it('exists for exactly the subtopics of the app', () => {
    expect(Object.keys(topicContent).sort()).toEqual(topics.map((t) => t.slug).sort())
    expect(findContent('gibt-es-nicht')).toBeUndefined()
    expect(findContent('toString')).toBeUndefined()
  })

  describe.each(TOPIC_IDS)('%s', (topic) => {
    const content = topicContent[topic]

    it('has an explanation, pitfalls and at least one worked example', () => {
      expect(content.sections.length).toBeGreaterThan(0)
      for (const section of content.sections) expect(section.paragraphs.length).toBeGreaterThan(0)
      expect(content.pitfalls.length).toBeGreaterThan(0)
      expect(content.examples.length).toBeGreaterThan(0)
    })

    it('only references known formulas', () => {
      expect(content.formulaIds.length).toBeGreaterThan(0)
      for (const id of content.formulaIds) expect(() => findFormula(id)).not.toThrow()
    })

    it('uses terms that parse, and every "=" and "≠" in the text is true', () => {
      for (const text of markupTexts(content)) {
        for (const source of mathSources(text)) {
          const { terms, relations } = splitChain(source)
          const polys = terms.map((term) => toPolynomial(parse(term)))
          relations.forEach((rel, i) => {
            const equal = polys[i]!.equals(polys[i + 1]!)
            expect(equal, `${source} (in: ${text})`).toBe(rel === '=')
          })
        }
      }
    })

    it('typesets every text term with KaTeX', () => {
      for (const text of markupTexts(content)) {
        for (const source of mathSources(text)) expect(() => renderStrict(chainToLatex(source))).not.toThrow()
      }
    })

    describe.each(content.examples.map((e) => [e.title, e] as const))('example "%s"', (_title, example) => {
      const { task } = example

      it('belongs to this subtopic', () => {
        expect(task.topic).toBe(topic)
      })

      it('has a worked solution whose result is accepted as correct', () => {
        expect(task.steps.length).toBeGreaterThan(1)
        for (const step of task.steps) expect(areEquivalent(step.expr, task.prompt)).toBe(true)
        expect(checkAnswer(task, toText(task.solution))).toEqual({ kind: 'correct' })
      })

      it('typesets prompt and steps with KaTeX', () => {
        for (const expr of [task.prompt, ...task.steps.map((s) => s.expr)]) {
          expect(() => renderStrict(toLatex(expr))).not.toThrow()
        }
      })
    })
  })

  it('works through the examples planned for unit 1', () => {
    const summary = Object.fromEntries(
      TOPIC_IDS.map((topic) => [
        topic,
        topicContent[topic].examples.map((e) => `${toText(e.task.prompt)} = ${toText(e.task.solution)}`),
      ]),
    )
    expect(summary).toEqual({
      ausmultiplizieren: ['(x + 3)(x - 5) = x² - 2x - 15', '(2a + b)(a - 3b) = 2a² - 5ab - 3b²'],
      'binomische-formeln': ['(x + 4)² = x² + 8x + 16', '(3x - 2)² = 9x² - 12x + 4', '(x + 5)(x - 5) = x² - 25'],
      faktorisieren: [
        '6x² + 9x = 3x(2x + 3)',
        'x² - 10x + 25 = (x - 5)²',
        '4x² - 9 = (2x + 3)(2x - 3)',
        '2x² + 12x + 18 = 2(x + 3)²',
      ],
    })
  })
})
