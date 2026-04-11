import OpenAI from 'openai'
import type {
  ExtractProblemRequest,
  GenerateDebugRequest,
  GenerateSolutionRequest,
  ProcessingProvider,
  ProcessingResult,
  ProblemInfo
} from '../types'

/**
 * OpenAI processing provider — ports the Electron OpenAIProcessingProvider
 * to server-side with ProcessingResult discriminated union error handling.
 *
 * Prompts and response parsing logic are identical to the Electron version
 * to ensure behavior parity.
 */
export class OpenAIProcessingProvider implements ProcessingProvider {
  public readonly provider = 'openai' as const
  private readonly client: OpenAI | null

  constructor(apiKey: string) {
    this.client = apiKey
      ? new OpenAI({
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
        error: 'OpenAI API key not configured. Set the OPENAI_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            'You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${request.language}.`
            },
            ...request.imageDataList.map((data) => ({
              type: 'image_url' as const,
              image_url: { url: `data:image/png;base64,${data}` }
            }))
          ]
        }
      ]

      const extractionResponse = await this.client.chat.completions.create({
        model: request.model || 'gpt-4o',
        messages,
        max_tokens: 4000,
        temperature: 0.2
      })

      const responseContent = extractionResponse.choices[0]?.message?.content
      const responseText =
        typeof responseContent === 'string' ? responseContent : ''

      if (!responseText) {
        return {
          success: false,
          error: 'Failed to parse problem information. Please try again or use clearer screenshots.',
          statusCode: 502
        }
      }

      try {
        const jsonText = responseText.replace(/```json|```/g, '').trim()
        return {
          success: true,
          data: JSON.parse(jsonText) as ProblemInfo
        }
      } catch {
        return {
          success: false,
          error: 'Failed to parse problem information. Please try again or use clearer screenshots.',
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
        error: 'OpenAI API key not configured. Set the OPENAI_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const solutionResponse = await this.client.chat.completions.create({
        model: request.model || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations.'
          },
          { role: 'user', content: request.promptText }
        ],
        max_tokens: 4000,
        temperature: 0.2
      })

      const responseContent = solutionResponse.choices[0]?.message?.content
      const responseText =
        typeof responseContent === 'string' ? responseContent : ''

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
        error: 'OpenAI API key not configured. Set the OPENAI_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content:
            "Follow the user's required debug report format exactly. Do not skip section headers."
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: request.debugPrompt
            },
            ...request.imageDataList.map((data) => ({
              type: 'image_url' as const,
              image_url: { url: `data:image/png;base64,${data}` }
            }))
          ]
        }
      ]

      const debugResponse = await this.client.chat.completions.create({
        model: request.model || 'gpt-4o',
        messages,
        max_tokens: 4000,
        temperature: 0.2
      })

      const responseContent = debugResponse.choices[0]?.message?.content
      const responseText =
        typeof responseContent === 'string' ? responseContent : ''

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
   * Map OpenAI API errors to appropriate HTTP status codes.
   * 401 → 401 (unauthorized), 429 → 429 (rate limited),
   * 500+ → 502 (bad gateway), network errors → 503 (service unavailable)
   */
  private handleError(error: unknown): ProcessingResult<never> {
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status
      if (status === 401) {
        return {
          success: false,
          error: 'OpenAI API key is invalid. Check your OPENAI_API_KEY environment variable.',
          statusCode: 401
        }
      }
      if (status === 429) {
        return {
          success: false,
          error: 'OpenAI API rate limit exceeded. Please wait a few minutes before trying again.',
          statusCode: 429
        }
      }
      if (status >= 500) {
        return {
          success: false,
          error: 'OpenAI API server error. Please try again later.',
          statusCode: 502
        }
      }
    }

    return {
      success: false,
      error: 'Failed to process with OpenAI API. Please check your API key or try again later.',
      statusCode: 503
    }
  }
}