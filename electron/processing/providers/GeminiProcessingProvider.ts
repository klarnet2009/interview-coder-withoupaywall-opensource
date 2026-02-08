import axios from "axios"
import type {
  ExtractProblemRequest,
  GenerateDebugRequest,
  GenerateSolutionRequest,
  ProcessingProviderStrategy,
  ProblemInfo,
  ProviderResult
} from "../types"

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
  return payload.candidates?.[0]?.content?.parts?.[0]?.text || ""
}

export class GeminiProcessingProvider implements ProcessingProviderStrategy {
  public readonly provider = "gemini" as const
  private readonly apiKey: string | null

  constructor(apiKey?: string) {
    this.apiKey = apiKey?.trim() || null
  }

  public isConfigured(): boolean {
    return this.apiKey !== null
  }

  public async extractProblem(
    request: ExtractProblemRequest
  ): Promise<ProviderResult<ProblemInfo>> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "Gemini API key not configured. Please check your settings."
      }
    }

    try {
      const geminiMessages: GeminiMessage[] = [
        {
          role: "user",
          parts: [
            {
              text: `You are a coding challenge interpreter. Analyze the screenshots of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text. Preferred coding language we gonna use for this problem is ${request.language}.`
            },
            ...request.imageDataList.map((data) => ({
              inlineData: {
                mimeType: "image/png",
                data
              }
            }))
          ]
        }
      ]

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${request.model || "gemini-3-flash-preview"}:generateContent?key=${this.apiKey}`,
        {
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4000
          }
        },
        { signal: request.signal }
      )

      const responseText = readGeminiText(response.data as GeminiResponse)
      if (!responseText) {
        throw new Error("Empty response from Gemini API")
      }

      const jsonText = responseText.replace(/```json|```/g, "").trim()
      try {
        return {
          success: true,
          data: JSON.parse(jsonText) as ProblemInfo
        }
      } catch {
        return {
          success: false,
          error: "Failed to parse problem information from Gemini response. Please try again."
        }
      }
    } catch {
      return {
        success: false,
        error:
          "Failed to process with Gemini API. Please check your API key or try again later."
      }
    }
  }

  public async generateSolution(
    request: GenerateSolutionRequest
  ): Promise<ProviderResult<string>> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "Gemini API key not configured. Please check your settings."
      }
    }

    try {
      const geminiMessages: GeminiMessage[] = [
        {
          role: "user",
          parts: [
            {
              text: `You are an expert coding interview assistant. Provide a clear, optimal solution with detailed explanations for this problem:\n\n${request.promptText}`
            }
          ]
        }
      ]

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${request.model || "gemini-3-flash-preview"}:generateContent?key=${this.apiKey}`,
        {
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4000
          }
        },
        { signal: request.signal }
      )

      const responseText = readGeminiText(response.data as GeminiResponse)
      if (!responseText) {
        throw new Error("Empty response from Gemini API")
      }

      return { success: true, data: responseText }
    } catch {
      return {
        success: false,
        error:
          "Failed to generate solution with Gemini API. Please check your API key or try again later."
      }
    }
  }

  public async generateDebug(
    request: GenerateDebugRequest
  ): Promise<ProviderResult<string>> {
    if (!this.apiKey) {
      return {
        success: false,
        error: "Gemini API key not configured. Please check your settings."
      }
    }

    try {
      const geminiMessages: GeminiMessage[] = [
        {
          role: "user",
          parts: [
            { text: request.debugPrompt },
            ...request.imageDataList.map((data) => ({
              inlineData: {
                mimeType: "image/png",
                data
              }
            }))
          ]
        }
      ]

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${request.model || "gemini-3-flash-preview"}:generateContent?key=${this.apiKey}`,
        {
          contents: geminiMessages,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4000
          }
        },
        { signal: request.signal }
      )

      const responseText = readGeminiText(response.data as GeminiResponse)
      if (!responseText) {
        throw new Error("Empty response from Gemini API")
      }

      return { success: true, data: responseText }
    } catch {
      return {
        success: false,
        error:
          "Failed to process debug request with Gemini API. Please check your API key or try again later."
      }
    }
  }
}
