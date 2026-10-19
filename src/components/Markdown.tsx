import { Fragment, type ReactNode } from 'react'

function inline(text: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${index}`}>
          {token.slice(2, -2)}
        </strong>
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={`${keyPrefix}-c-${index}`} className="inline-code">
          {token.slice(1, -1)}
        </code>
      )
    } else {
      nodes.push(
        <span key={`${keyPrefix}-r-${index}`} className="citation-inline">
          {token}
        </span>
      )
    }
    lastIndex = pattern.lastIndex
    index += 1
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let quote: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    const text = paragraph.join(' ')
    blocks.push(
      <p key={`p-${blocks.length}`}>
        {inline(text, `p-${blocks.length}`)}
      </p>
    )
    paragraph = []
  }

  const flushList = () => {
    if (!list) return
    const Tag = list.ordered ? 'ol' : 'ul'
    blocks.push(
      <Tag key={`list-${blocks.length}`} className="md-list">
        {list.items.map((item, i) => (
          <li key={i}>{inline(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </Tag>
    )
    list = null
  }

  const flushQuote = () => {
    if (!quote.length) return
    blocks.push(
      <blockquote key={`quote-${blocks.length}`}>
        {inline(quote.join(' '), `q-${blocks.length}`)}
      </blockquote>
    )
    quote = []
  }

  const flushAll = () => {
    flushParagraph()
    flushList()
    flushQuote()
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushAll()
      continue
    }
    if (line.startsWith('### ')) {
      flushAll()
      blocks.push(
        <h4 key={`h4-${blocks.length}`} className="md-h4">
          {inline(line.slice(4), `h4-${blocks.length}`)}
        </h4>
      )
      continue
    }
    if (line.startsWith('## ')) {
      flushAll()
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="md-h3">
          {inline(line.slice(3), `h3-${blocks.length}`)}
        </h3>
      )
      continue
    }
    if (line.startsWith('# ')) {
      flushAll()
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="md-h2">
          {inline(line.slice(2), `h2-${blocks.length}`)}
        </h2>
      )
      continue
    }
    if (line.startsWith('> ')) {
      flushParagraph()
      flushList()
      quote.push(line.slice(2))
      continue
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph()
      flushQuote()
      if (!list || list.ordered) {
        flushList()
        list = { ordered: false, items: [] }
      }
      list.items.push(line.slice(2))
      continue
    }
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      flushParagraph()
      flushQuote()
      if (!list || !list.ordered) {
        flushList()
        list = { ordered: true, items: [] }
      }
      list.items.push(orderedMatch[1])
      continue
    }
    flushList()
    flushQuote()
    paragraph.push(line)
  }
  flushAll()

  return <div className="markdown">{blocks.map((block, i) => <Fragment key={i}>{block}</Fragment>)}</div>
}
