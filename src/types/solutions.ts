export interface Solution {
  initial_thoughts: string[]
  thought_steps: string[]
  description: string
  code: string
}

export interface SolutionsResponse {
  [key: string]: Solution
}

export interface ProblemStatementData {
  problem_statement: string
  input_format: {
    description: string
    parameters: unknown[]
  }
  output_format: {
    description: string
    type: string
    subtype: string
  }
  complexity: {
    time: string
    space: string
  }
  test_cases: unknown[]
  validation_type: string
  difficulty: string
}
