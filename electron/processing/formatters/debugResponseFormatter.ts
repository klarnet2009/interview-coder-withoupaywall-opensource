export interface FormattedDebugResponse {
  code: string
  debug_analysis: string
  thoughts: string[]
  issues: string[]
  fixes: string[]
  why: string[]
  verify: string[]
  next_steps: string[]
  time_complexity: string
  space_complexity: string
}

const normalizeHeading = (line: string) =>
  line
    .replace(/^#+\s*/, "")
    .replace(/\*\*/g, "")
    .replace(/[:-]+$/, "")
    .trim()
    .toLowerCase()

const isPotentialHeading = (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (/^#{1,3}\s+/.test(trimmed)) return true
  if (/^\*\*.+\*\*$/.test(trimmed)) return true
  return /^[A-Za-z][A-Za-z\s/&()-]{2,48}:?$/.test(trimmed)
}

const toBulletList = (raw: string): string[] => {
  const normalized = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const bullets = normalized
    .filter((line) => /^[-*\u2022]\s+/.test(line) || /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^[-*\u2022]\s+|^\d+\.\s+/, "").trim())
    .filter(Boolean)

  if (bullets.length > 0) {
    return bullets
  }

  return normalized
    .join(" ")
    .split(/(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

const extractSection = (analysis: string, aliases: string[]): string[] => {
  const lines = analysis.split(/\r?\n/)
  let start = -1
  let end = lines.length

  for (let index = 0; index < lines.length; index += 1) {
    const normalized = normalizeHeading(lines[index] || "")
    if (aliases.some((alias) => normalized.includes(alias))) {
      start = index + 1
      break
    }
  }

  if (start === -1) {
    return []
  }

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index]
    if (
      isPotentialHeading(line) &&
      !aliases.some((alias) => normalizeHeading(line).includes(alias))
    ) {
      end = index
      break
    }
  }

  return toBulletList(lines.slice(start, end).join("\n"))
}

export const formatDebugResponse = (
  responseContent: string
): FormattedDebugResponse => {
  const codeMatch = responseContent.match(/```(?:[a-zA-Z]+)?([\s\S]*?)```/)
  const code = codeMatch?.[1]?.trim() || "// Debug mode - see analysis below"

  let formattedDebugContent = responseContent
  if (!responseContent.includes("# ") && !responseContent.includes("## ")) {
    formattedDebugContent = responseContent
      .replace(/issues identified|problems found|bugs found/i, "### Issue")
      .replace(
        /specific improvements and corrections|code improvements|improvements|suggested changes/i,
        "### Fix"
      )
      .replace(
        /explanation of changes needed|explanation|detailed analysis|rationale/i,
        "### Why"
      )
      .replace(/verify|validation|key points|checks/i, "### Verify")
  }

  const issues = extractSection(formattedDebugContent, [
    "issue",
    "issues identified",
    "problems",
    "bugs"
  ])
  const fixes = extractSection(formattedDebugContent, [
    "fix",
    "specific improvements",
    "corrections",
    "improvements"
  ])
  const why = extractSection(formattedDebugContent, [
    "why",
    "explanation",
    "rationale",
    "changes needed"
  ])
  const verify = extractSection(formattedDebugContent, [
    "verify",
    "validation",
    "test plan",
    "checks",
    "key points"
  ])

  const keyPoints = extractSection(formattedDebugContent, [
    "key points",
    "summary"
  ]).slice(0, 5)

  const thoughts =
    keyPoints.length > 0 ? keyPoints : [...issues, ...fixes].slice(0, 5)

  const nextSteps =
    verify.length > 0
      ? verify
      : [
          "Re-run failing tests and compare with expected output after applying fixes."
        ]

  return {
    code,
    debug_analysis: formattedDebugContent,
    thoughts,
    issues,
    fixes,
    why,
    verify,
    next_steps: nextSteps,
    time_complexity: "N/A - Debug mode",
    space_complexity: "N/A - Debug mode"
  }
}
