/**
 * Backend processing types for AI provider abstraction.
 * Adapts the Electron ProcessingProviderStrategy pattern for server-side use.
 * Key difference: ProcessingResult uses discriminated union with statusCode
 * matching the AuthResult pattern from Phase 01.
 */

export type ApiProvider = 'openai' | 'gemini' | 'anthropic'

// Discriminated union matching AuthResult pattern from Phase 01
export type ProcessingResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode: number }

export interface ExtractProblemRequest {
  imageDataList: string[] // base64-encoded PNG data
  language: string
  model?: string
}

export interface GenerateSolutionRequest {
  promptText: string
  model?: string
}

export interface GenerateDebugRequest {
  debugPrompt: string
  imageDataList: string[] // base64-encoded PNG data
  model?: string
}

export interface ProblemInfo {
  problem_statement?: string
  constraints?: string
  example_input?: string
  example_output?: string
  [key: string]: unknown
}

export interface ProcessingProvider {
  readonly provider: ApiProvider
  isConfigured(): boolean
  extractProblem(request: ExtractProblemRequest): Promise<ProcessingResult<ProblemInfo>>
  generateSolution(request: GenerateSolutionRequest): Promise<ProcessingResult<string>>
  generateDebug(request: GenerateDebugRequest): Promise<ProcessingResult<string>>
}