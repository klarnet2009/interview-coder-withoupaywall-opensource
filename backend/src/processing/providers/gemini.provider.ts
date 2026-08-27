import axios from 'axios'
import { resolveGeminiModelId } from './gemini.models'
import type {
  ExtractProblemRequest,
  GenerateDebugRequest,
  GenerateSolutionRequest,
  ProcessingProvider,
  ProcessingResult,
  ProblemInfo
} from '../types'

interface GeminiMessage {
  role: string
  parts: Array<{
    text?: string
    inlineData?: {
      mimeType: string
      data: string
    }
  }>
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

const readGeminiText = (payload: GeminiResponse): string => {
  return payload.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

/**
 * Gemini processing provider — ports the Electron GeminiProcessingProvider
 * to server-side with ProcessingResult discriminated union error handling.
 *
 * Prompts and message format are identical to the Electron version.
 * Uses REST API directly instead of a dedicated SDK.
 */
export class GeminiProcessingProvider implements ProcessingProvider {
  public readonly provider = 'gemini' as const
  private readonly apiKey: string | null

  constructor(apiKey: string) {
    this.apiKey = apiKey?.trim() || null
  }

  public isConfigured(): boolean {
    return this.apiKey !== null
  }

  public async extractProblem(
    request: ExtractProblemRequest
  ): Promise<ProcessingResult<ProblemInfo>> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Gemini API key not configured. Set the GEMINI_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const model = resolveGeminiModelId(request.model)
      const geminiMessages: GeminiMessage[] = [
        {
          role: 'user',
          parts: [
            {
              text: `You are a coding challenge interpreter. Analyze the screenshots of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text. Preferred coding language we gonna use for this problem is ${request.language}.`
            },
            ...request.imageDataList.map((data) => ({
              inlineData: {
                mimeType: 'image/png',
                data
              }
            }))
          ]
        }
      ]

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
        {
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4000
          }
        }
      )

      const responseText = readGeminiText(response.data as GeminiResponse)
      if (!responseText) {
        return {
          success: false,
          error: 'Failed to parse problem information from Gemini response.',
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
          error: 'Failed to parse problem information from Gemini response. Please try again.',
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
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Gemini API key not configured. Set the GEMINI_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const model = resolveGeminiModelId(request.model)
      const geminiMessages: GeminiMessage[] = [
        {
          role: 'user',
          parts: [
            {
              text: `You are an expert coding interview assistant. Provide a clear, optimal solution with detailed explanations for this problem:\n\n${request.promptText}`
            }
          ]
        }
      ]

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
        {
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4000
          }
        }
      )

      const responseText = readGeminiText(response.data as GeminiResponse)
      if (!responseText) {
        return {
          success: false,
          error: 'Failed to generate solution with Gemini API. Empty response.',
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
    if (!this.apiKey) {
      return {
        success: false,
        error: 'Gemini API key not configured. Set the GEMINI_API_KEY environment variable.',
        statusCode: 503
      }
    }

    try {
      const model = resolveGeminiModelId(request.model)
      const geminiMessages: GeminiMessage[] = [
        {
          role: 'user',
          parts: [
            { text: request.debugPrompt },
            ...request.imageDataList.map((data) => ({
              inlineData: {
                mimeType: 'image/png',
                data
              }
            }))
          ]
        }
      ]

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`,
        {
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4000
          }
        }
      )

      const responseText = readGeminiText(response.data as GeminiResponse)
      if (!responseText) {
        return {
          success: false,
          error: 'Failed to generate debug analysis with Gemini API. Empty response.',
          statusCode: 502
        }
      }

      return { success: true, data: responseText }
    } catch (error: unknown) {
      return this.handleError(error)
    }
  }

  /**
   * Map Gemini/axios errors to appropriate HTTP status codes.
   * 400/401 → 401, 429 → 429, others → 502 or 503
   */
  private handleError(error: unknown): ProcessingResult<never> {
    // Check if this is an axios error by duck-typing
    if (typeof error === 'object' && error !== null && 'isAxiosError' in error) {
      const axiosErr = error as { response?: { status?: number }; isAxiosError: boolean }
      const status = axiosErr.response?.status
      if (status === 400 || status === 401 || status === 403) {
        return {
          success: false,
          error: 'Gemini API key is invalid. Check your GEMINI_API_KEY environment variable.',
          statusCode: 401
        }
      }
      if (status === 429) {
        return {
          success: false,
          error: 'Gemini API rate limit exceeded. Please wait a few minutes before trying again.',
          statusCode: 429
        }
      }
      if (status && status >= 500) {
        return {
          success: false,
          error: 'Gemini API server error. Please try again later.',
          statusCode: 502
        }
      }
    }

    return {
      success: false,
      error: 'Failed to process with Gemini API. Please check your API key or try again later.',
      statusCode: 503
    }
  }
}