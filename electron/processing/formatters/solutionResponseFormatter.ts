const DEFAULT_TIME_COMPLEXITY =
  "O(n) - Linear time complexity because we only iterate through the array once. Each element is processed exactly one time, and the hashmap lookups are O(1) operations."
const DEFAULT_SPACE_COMPLEXITY =
  "O(n) - Linear space complexity because we store elements in the hashmap. In the worst case, we might need to store all elements before finding the solution pair."

export interface FormattedSolutionResponse {
  code: string
  thoughts: string[]
  time_complexity: string
  space_complexity: string
}

const normalizeComplexity = (value: string): string => {
  if (!value.match(/O\([^)]+\)/i)) {
    return `O(n) - ${value}`
  }

  if (!value.includes("-") && !value.includes("because")) {
    const notationMatch = value.match(/O\([^)]+\)/i)
    if (notationMatch) {
      const notation = notationMatch[0]
      const rest = value.replace(notation, "").trim()
      return `${notation} - ${rest}`
    }
  }

  return value
}

export const formatSolutionResponse = (
  responseContent: string
): FormattedSolutionResponse => {
  const codeMatch = responseContent.match(/```(?:\w+)?\s*([\s\S]*?)```/)
  const code = codeMatch ? codeMatch[1].trim() : responseContent

  const thoughtsRegex =
    /(?:Thoughts:|Key Insights:|Reasoning:|Approach:)([\s\S]*?)(?:Time complexity:|$)/i
  const thoughtsMatch = responseContent.match(thoughtsRegex)
  let thoughts: string[] = []

  if (thoughtsMatch && thoughtsMatch[1]) {
    const bulletPoints = thoughtsMatch[1].match(
      /(?:^|\n)\s*(?:[-*\u2022]|\d+\.)\s*(.*)/g
    )
    if (bulletPoints) {
      thoughts = bulletPoints
        .map((point) => point.replace(/^\s*(?:[-*\u2022]|\d+\.)\s*/, "").trim())
        .filter(Boolean)
    } else {
      thoughts = thoughtsMatch[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    }
  }

  const timeComplexityPattern =
    /Time complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:Space complexity|$))/i
  const spaceComplexityPattern =
    /Space complexity:?\s*([^\n]+(?:\n[^\n]+)*?)(?=\n\s*(?:[A-Z]|$))/i

  let timeComplexity = DEFAULT_TIME_COMPLEXITY
  let spaceComplexity = DEFAULT_SPACE_COMPLEXITY

  const timeMatch = responseContent.match(timeComplexityPattern)
  if (timeMatch && timeMatch[1]) {
    timeComplexity = normalizeComplexity(timeMatch[1].trim())
  }

  const spaceMatch = responseContent.match(spaceComplexityPattern)
  if (spaceMatch && spaceMatch[1]) {
    spaceComplexity = normalizeComplexity(spaceMatch[1].trim())
  }

  return {
    code,
    thoughts:
      thoughts.length > 0
        ? thoughts
        : ["Solution approach based on efficiency and readability"],
    time_complexity: timeComplexity,
    space_complexity: spaceComplexity
  }
}
