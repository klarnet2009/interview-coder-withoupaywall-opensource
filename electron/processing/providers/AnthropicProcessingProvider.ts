import Anthropic from "@anthropic-ai/sdk"
import type {
  ExtractProblemRequest,
  GenerateDebugRequest,
  GenerateSolutionRequest,
  ProcessingProviderStrategy,
  ProblemInfo,
  ProviderResult
} from "../types"

const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined
  }
  const maybeError = error as { status?: number; response?: { status?: number } }
  return maybeError.status ?? maybeError.response?.status
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return "Unknown Anthropic API error"
}

const isClaudePayloadTooLarge = (error: unknown): boolean => {
  const status = getErrorStatus(error)
  const message = getErrorMessage(error)
  return status === 413 || message.includes("token")
}

const readText = (response: Anthropic.Messages.Message): string => {
  const firstChunk = response.content[0]
  if (firstChunk?.type === "text") {
    return firstChunk.text
  }
  return ""
}

export class AnthropicProcessingProvider implements ProcessingProviderStrategy {
  public readonly provider = "anthropic" as const
  private readonly client: Anthropic | null

  constructor(apiKey?: string) {
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
  ): Promise<ProviderResult<ProblemInfo>> {
    if (!this.client) {
      return {
        success: false,
        error: "Anthropic API key not configured. Please check your settings."
      }
    }

    try {
      const response = await this.client.messages.create({
        model: request.model || "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract the coding problem details from these screenshots. Return in JSON format with these fields: problem_statement, constraints, example_input, example_output. Preferred coding language is ${request.language}.`
              },
              ...request.imageDataList.map((data) => ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: "image/png" as const,
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
        throw new Error("Empty response from Anthropic API")
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
          error: "Failed to parse problem information from Anthropic response. Please try again."
        }
      }
    } catch (error: unknown) {
      if (getErrorStatus(error) === 429) {
        return {
          success: false,
          error:
            "Claude API rate limit exceeded. Please wait a few minutes before trying again."
        }
      }

      if (isClaudePayloadTooLarge(error)) {
        return {
          success: false,
          error:
            "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
        }
      }

      return {
        success: false,
        error:
          "Failed to process with Anthropic API. Please check your API key or try again later."
      }
    }
  }

  public async generateSolution(
    request: GenerateSolutionRequest
  ): Promise<ProviderResult<string>> {
    if (!this.client) {
      return {
        success: false,
        error: "Anthropic API key not configured. Please check your settings."
      }
    }

    try {
      const response = await this.client.messages.create({
        model: request.model || "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
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
          error: "Failed to generate solution. No response from AI provider."
        }
      }

      return { success: true, data: responseText }
    } catch (error: unknown) {
      if (getErrorStatus(error) === 429) {
        return {
          success: false,
          error:
            "Claude API rate limit exceeded. Please wait a few minutes before trying again."
        }
      }

      if (isClaudePayloadTooLarge(error)) {
        return {
          success: false,
          error:
            "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
        }
      }

      return {
        success: false,
        error:
          "Failed to generate solution with Anthropic API. Please check your API key or try again later."
      }
    }
  }

  public async generateDebug(
    request: GenerateDebugRequest
  ): Promise<ProviderResult<string>> {
    if (!this.client) {
      return {
        success: false,
        error: "Anthropic API key not configured. Please check your settings."
      }
    }

    try {
      const response = await this.client.messages.create({
        model: request.model || "claude-3-7-sonnet-20250219",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: request.debugPrompt
              },
              ...request.imageDataList.map((data) => ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: "image/png" as const,
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
          error: "Failed to generate debug analysis. No response from AI provider."
        }
      }

      return { success: true, data: responseText }
    } catch (error: unknown) {
      if (getErrorStatus(error) === 429) {
        return {
          success: false,
          error:
            "Claude API rate limit exceeded. Please wait a few minutes before trying again."
        }
      }

      if (isClaudePayloadTooLarge(error)) {
        return {
          success: false,
          error:
            "Your screenshots contain too much information for Claude to process. Switch to OpenAI or Gemini in settings which can handle larger inputs."
        }
      }

      return {
        success: false,
        error:
          "Failed to process debug request with Anthropic API. Please check your API key or try again later."
      }
    }
  }
}
