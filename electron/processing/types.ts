export type ApiProvider = "openai" | "gemini" | "anthropic"

export interface ProviderConfig {
  apiProvider: ApiProvider
  apiKey?: string
  extractionModel?: string
  solutionModel?: string
  debuggingModel?: string
}

export interface ProblemInfo {
  problem_statement?: string
  constraints?: string
  example_input?: string
  example_output?: string
  [key: string]: unknown
}

export interface ProviderResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ExtractProblemRequest {
  imageDataList: string[]
  language: string
  model?: string
  signal: AbortSignal
}

export interface GenerateSolutionRequest {
  promptText: string
  model?: string
  signal: AbortSignal
}

export interface GenerateDebugRequest {
  debugPrompt: string
  imageDataList: string[]
  model?: string
  signal: AbortSignal
}

export interface ProcessingProviderStrategy {
  readonly provider: ApiProvider
  isConfigured(): boolean
  extractProblem(request: ExtractProblemRequest): Promise<ProviderResult<ProblemInfo>>
  generateSolution(request: GenerateSolutionRequest): Promise<ProviderResult<string>>
  generateDebug(request: GenerateDebugRequest): Promise<ProviderResult<string>>
}
