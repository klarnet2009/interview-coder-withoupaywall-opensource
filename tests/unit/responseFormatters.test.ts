/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest"
import { formatDebugResponse } from "../../electron/processing/formatters/debugResponseFormatter"
import { formatSolutionResponse } from "../../electron/processing/formatters/solutionResponseFormatter"

describe("formatSolutionResponse", () => {
  it("extracts code, thoughts and complexity from structured response", () => {
    const content = [
      "```python",
      "def solve(nums, target):",
      "    return [0, 1]",
      "```",
      "Thoughts:",
      "- Use a one-pass hash map",
      "- Keep solution O(n)",
      "Time complexity: O(n) because each element is processed once.",
      "Space complexity: O(n) because we store seen values."
    ].join("\n")

    const result = formatSolutionResponse(content)

    expect(result.code).toContain("def solve")
    expect(result.thoughts).toEqual([
      "Use a one-pass hash map",
      "Keep solution O(n)"
    ])
    expect(result.time_complexity).toContain("O(n)")
    expect(result.space_complexity).toContain("O(n)")
  })

  it("uses fallbacks when sections are missing", () => {
    const content = "print('hello world')"
    const result = formatSolutionResponse(content)

    expect(result.code).toBe(content)
    expect(result.thoughts).toEqual([
      "Solution approach based on efficiency and readability"
    ])
    expect(result.time_complexity).toContain("Linear time complexity")
    expect(result.space_complexity).toContain("Linear space complexity")
  })
})

describe("formatDebugResponse", () => {
  it("extracts debug sections from structured markdown", () => {
    const content = [
      "### Issue",
      "- Off-by-one error",
      "### Fix",
      "- Include the upper bound in iteration",
      "### Why",
      "- Prevents skipping the last candidate",
      "### Verify",
      "- Re-run edge cases",
      "```python",
      "for i in range(n + 1):",
      "    pass",
      "```"
    ].join("\n")

    const result = formatDebugResponse(content)

    expect(result.code).toContain("for i in range")
    expect(result.issues).toEqual(["Off-by-one error"])
    expect(result.fixes).toEqual(["Include the upper bound in iteration"])
    expect(result.why).toEqual(["Prevents skipping the last candidate"])
    expect(result.verify).toEqual(["Re-run edge cases"])
    expect(result.next_steps).toEqual(["Re-run edge cases"])
    expect(result.time_complexity).toBe("N/A - Debug mode")
  })

  it("normalizes non-markdown section labels and keeps default next step", () => {
    const content = [
      "issues identified",
      "- Wrong index handling",
      "specific improvements and corrections",
      "- Update boundary condition",
      "explanation",
      "- Prevent invalid access",
      "Run tests after fix"
    ].join("\n")

    const result = formatDebugResponse(content)

    expect(result.issues).toEqual(["Wrong index handling"])
    expect(result.fixes).toEqual(["Update boundary condition"])
    expect(result.why).toEqual(["Prevent invalid access"])
    expect(result.next_steps).toEqual([
      "Re-run failing tests and compare with expected output after applying fixes."
    ])
  })
})
