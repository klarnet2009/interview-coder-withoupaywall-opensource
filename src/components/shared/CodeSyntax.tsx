import React from "react"
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism"

import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash"
import c from "react-syntax-highlighter/dist/esm/languages/prism/c"
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp"
import csharp from "react-syntax-highlighter/dist/esm/languages/prism/csharp"
import go from "react-syntax-highlighter/dist/esm/languages/prism/go"
import java from "react-syntax-highlighter/dist/esm/languages/prism/java"
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript"
import json from "react-syntax-highlighter/dist/esm/languages/prism/json"
import kotlin from "react-syntax-highlighter/dist/esm/languages/prism/kotlin"
import php from "react-syntax-highlighter/dist/esm/languages/prism/php"
import python from "react-syntax-highlighter/dist/esm/languages/prism/python"
import ruby from "react-syntax-highlighter/dist/esm/languages/prism/ruby"
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust"
import scala from "react-syntax-highlighter/dist/esm/languages/prism/scala"
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql"
import swift from "react-syntax-highlighter/dist/esm/languages/prism/swift"
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript"

SyntaxHighlighter.registerLanguage("bash", bash)
SyntaxHighlighter.registerLanguage("c", c)
SyntaxHighlighter.registerLanguage("cpp", cpp)
SyntaxHighlighter.registerLanguage("csharp", csharp)
SyntaxHighlighter.registerLanguage("go", go)
SyntaxHighlighter.registerLanguage("java", java)
SyntaxHighlighter.registerLanguage("javascript", javascript)
SyntaxHighlighter.registerLanguage("json", json)
SyntaxHighlighter.registerLanguage("kotlin", kotlin)
SyntaxHighlighter.registerLanguage("php", php)
SyntaxHighlighter.registerLanguage("python", python)
SyntaxHighlighter.registerLanguage("ruby", ruby)
SyntaxHighlighter.registerLanguage("rust", rust)
SyntaxHighlighter.registerLanguage("scala", scala)
SyntaxHighlighter.registerLanguage("sql", sql)
SyntaxHighlighter.registerLanguage("swift", swift)
SyntaxHighlighter.registerLanguage("typescript", typescript)

const LANGUAGE_ALIASES: Record<string, string> = {
  golang: "go",
  js: "javascript",
  ts: "typescript",
  py: "python",
  "c++": "cpp",
  "c#": "csharp",
  sh: "bash",
  shell: "bash"
}

interface CodeSyntaxProps {
  code: string
  language: string
  showLineNumbers?: boolean
  wrapLongLines?: boolean
  customStyle?: React.CSSProperties
}

export const CodeSyntax: React.FC<CodeSyntaxProps> = ({
  code,
  language,
  showLineNumbers = false,
  wrapLongLines = true,
  customStyle
}) => {
  const normalizedLanguage = LANGUAGE_ALIASES[language.toLowerCase()] || language

  return (
    <SyntaxHighlighter
      showLineNumbers={showLineNumbers}
      language={normalizedLanguage}
      style={dracula}
      customStyle={customStyle}
      wrapLongLines={wrapLongLines}
    >
      {code}
    </SyntaxHighlighter>
  )
}
