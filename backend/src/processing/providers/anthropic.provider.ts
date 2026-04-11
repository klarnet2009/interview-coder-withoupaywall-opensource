import Anthropic from '@anthropic-ai/sdk'
import type {
  ExtractProblemRequest,
  GenerateDebugRequest,
  GenerateSolutionRequest,
  ProcessingProvider,
  ProcessingResult,
  ProblemInfo
} from '../types'

const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }
  const maybeError = error as { status?: number }
  return maybeError.status
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unknown Anthropic API error'
}

const isClaudePayloadTooLarge = (error: unknown): boolean => {
  const status = getErrorStatus(error)
  const message = getErrorMessage(error)
  return status === 413 || message.includes('token')
}

const readText = (response: Anthropic.Messages.Message): string => {
  const firstChunk = response.content[0]
  if (firstChunk?.type === 'text') {
    return firstChunk.text
  }
  return ''
}

/**
 * Anthropic processing provider — ports the Electron AnthropicProcessingProvider
 * to server-side with ProcessingResult discriminated union error handling.
 *
 * Prompts and message format are identical to the Electron version.
 * Error handling maps Anthropic-specific errors to statusCode values.
 */
export class AnthropicProcessingProvider implements ProcessingProvider {
  public readonly provider = 'anthropic' as const
  private readonly client: Anthropic | null

  constructor(apiKey: string) {
    this.client = apiKey
      ? new Anthropic({
          apiKey,
          timeout: 60000,
          maxRetries: 2
        })
      : null
  }

  public isConfigured(): boolean {
    return this.client !== null
  }

  public async extractProblem(
    request: ExtractProblemRequest
  ): Promise<ProcessingResult<ProblemInfo>> {
    if (!this.client) {
      return {
        success: false,
        error: 'Anthropic API key not configured. Set the ANTHROPIC_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const response = await this.client.messages.create({
        model: request.model || 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract the coding problem details from these screenshots. Return in JSON format with these fields: problem_statement, constraints, example_input, example_output. Preferred coding language is ${request.language}.`
              },
              ...request.imageDataList.map((data) => ({
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: 'image/png' as const,
                  data
                }
              }))
            ]
          }
        ],
        temperature: 0.2
      })

      const responseText = readText(response)
      if (!responseText) {
        return {
          success: false,
          error: 'Failed to parse problem information from Anthropic response.',
          statusCode: 502
        }
      }

      const jsonText = responseText.replace(/```json|```/g, '').trim()
      try {
        return {
          success: true,
          data: JSON.parse(jsonText) as ProblemInfo
        }
      } catch {
        return {
          success: false,
          error: 'Failed to parse problem information from Anthropic response. Please try again.',
          statusCode: 502
        }
      }
    } catch (error: unknown) {
      return this.handleError(error)
    }
  }

  public async generateSolution(
    request: GenerateSolutionRequest
  ): Promise<ProcessingResult<string>> {
    if (!this.client) {
      return {
        success: false,
        error: 'Anthropic API key not configured. Set the ANTHROPIC_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const response = await this.client.messages.create({
        model: request.model || 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `You are an expert coding interview assistant. Provide a clear, optimal solution with detailed explanations for this problem:\n\n${request.promptText}`
              }
            ]
          }
        ],
        temperature: 0.2
      })

      const responseText = readText(response)
      if (!responseText) {
        return {
          success: false,
          error: 'Failed to generate solution. No response from AI provider.',
          statusCode: 502
        }
      }

      return { success: true, data: responseText }
    } catch (error: unknown) {
      return this.handleError(error)
    }
  }

  public async generateDebug(
    request: GenerateDebugRequest
  ): Promise<ProcessingResult<string>> {
    if (!this.client) {
      return {
        success: false,
        error: 'Anthropic API key not configured. Set the ANTHROPIC_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const response = await this.client.messages.create({
        model: request.model || 'claude-3-7-sonnet-20250219',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: request.debugPrompt
              },
              ...request.imageDataList.map((data) => ({
                type: 'image' as const,
                source: {
                  type: 'base64' as const,
                  media_type: 'image/png' as const,
                  data
                }
              }))
            ]
          }
        ],
        temperature: 0.2
      })

      const responseText = readText(response)
      if (!responseText) {
        return {
          success: false,
          error: 'Failed to generate debug analysis. No response from AI provider.',
          statusCode: 502
        }
      }

      return { success: true, data: responseText }
    } catch (error: unknown) {
      return this.handleError(error)
    }
  }

  /**
   * Map Anthropic API errors to appropriate HTTP status codes.
   * 429 → 429 (rate limited), 413 → 502 (payload too large → bad gateway for proxy),
   * other errors → 503 (service unavailable)
   */
  private handleError(error: unknown): ProcessingResult<never> {
    const status = getErrorStatus(error)

    if (status === 429) {
      return {
        success: false,
        error: 'Claude API rate limit exceeded. Please wait a few minutes before trying again.',
        statusCode: 429
      }
    }

    if (isClaudePayloadTooLarge(error)) {
      return {
        success: false,
        error: 'Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini which can handle larger inputs.',
        statusCode: 502
      }
    }

    return {
      success: false,
      error: 'Failed to process with Anthropic API. Please check your API key or try again later.',
      statusCode: 503
    }
  }
}