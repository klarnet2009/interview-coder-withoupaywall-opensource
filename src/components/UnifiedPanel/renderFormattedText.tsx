import React from "react"

/**
 * Lightweight markdown-to-React renderer for hint responses.
 * Supports: **bold**, *italic*, `code`, bullet points (• / -)
 */
export function renderFormattedText(text: string): React.ReactNode {
  const lines = text.split("\n")
  return lines.map((line, lineIdx) => {
    const bulletMatch = line.match(/^(\s*)(•|-|\*)\s+(.*)$/)
    const isBullet = !!bulletMatch
    const lineContent = isBullet ? bulletMatch![3] : line

    const parts: React.ReactNode[] = []
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(lineContent)) !== null) {
      if (match.index > lastIndex) {
        parts.push(lineContent.slice(lastIndex, match.index))
      }
      if (match[2]) {
        parts.push(
          <strong
            key={`${lineIdx}-b-${match.index}`}
            className="font-semibold text-white"
          >
            {match[2]}
          </strong>
        )
      } else if (match[3]) {
        parts.push(
          <em
            key={`${lineIdx}-i-${match.index}`}
            className="italic text-white/80"
          >
            {match[3]}
          </em>
        )
      } else if (match[4]) {
        parts.push(
          <code
            key={`${lineIdx}-c-${match.index}`}
            className="bg-white/10 px-1 py-0.5 rounded text-[12px] font-mono text-purple-300"
          >
            {match[4]}
          </code>
        )
      }
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < lineContent.length) {
      parts.push(lineContent.slice(lastIndex))
    }

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex gap-1.5 ml-1">
          <span className="text-purple-400 shrink-0">•</span>
          <span>{parts}</span>
        </div>
      )
    }

    return (
      <React.Fragment key={lineIdx}>
        {parts}
        {lineIdx < lines.length - 1 && "\n"}
      </React.Fragment>
    )
  })
}
