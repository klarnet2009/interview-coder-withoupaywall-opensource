import { OpenAI } from "openai"
import type {
  ExtractProblemRequest,
  GenerateDebugRequest,
  GenerateSolutionRequest,
  ProcessingProviderStrategy,
  ProblemInfo,
  ProviderResult
} from "../types"

export class OpenAIProcessingProvider implements ProcessingProviderStrategy {
  public readonly provider: "openai" | "custom"
  private readonly client: OpenAI | null

  constructor(apiKey?: string, baseUrl?: string, isCustom = false) {
    this.provider = isCustom ? "custom" : "openai"
    const finalKey = apiKey?.trim() || (isCustom ? "dummy-key" : "")
    this.client = finalKey
      ? new OpenAI({
          apiKey: finalKey,
          baseURL: baseUrl?.trim() || undefined,
          timeout: 60000,
          maxRetries: 2
        })
      : null
  }

  public isConfigured(): boolean {
    return this.client !== null
  }

  private isReasoningModel(model: string): boolean {
    const m = model.toLowerCase()
    return m.startsWith("o1") || m.startsWith("o3") || m.includes("deepseek-r1")
  }

  private buildCompletionPayload(
    model: string,
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    request: { temperature?: number; reasoningEffort?: "low" | "medium" | "high"; maxTokens?: number }
  ): OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming {
    const isReasoning = this.isReasoningModel(model)
    const payload: Record<string, unknown> = {
      model,
      messages
    }

    if (isReasoning) {
      if (request.reasoningEffort) {
        payload.reasoning_effort = request.reasoningEffort
      }
      payload.max_completion_tokens = request.maxTokens || 4000
    } else {
      payload.temperature = request.temperature !== undefined ? request.temperature : 0.2
      payload.max_tokens = request.maxTokens || 4000
    }

    return payload as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming
  }

  public async extractProblem(
    request: ExtractProblemRequest
  ): Promise<ProviderResult<ProblemInfo>> {
    if (!this.client) {
      return {
        success: false,
        error: `${this.provider === "custom" ? "Custom/OpenAI" : "OpenAI"} API key not configured or invalid. Please check your settings.`
      }
    }

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content:
            "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${request.language}.`
            },
            ...request.imageDataList.map((data) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${data}` }
            }))
          ]
        }
      ]

      const payload = this.buildCompletionPayload(request.model || "gpt-4o", messages, request)
      const extractionResponse = await this.client.chat.completions.create(payload, { signal: request.signal })

      const responseContent = extractionResponse.choices[0]?.message?.content
      const responseText =
        typeof responseContent === "string" ? responseContent : ""

      if (!responseText) {
        return {
          success: false,
          error:
            "Failed to parse problem information. Please try again or use clearer screenshots."
        }
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
          error:
            "Failed to parse problem information from JSON response. Please retry with clearer screenshots."
        }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number }
      if (err.status === 401) {
        return { success: false, error: "Invalid API key provided. Please check your API settings." }
      }
      if (err.status === 429) {
        return { success: false, error: "API rate limit exceeded or quota exhausted. Please check your account limits." }
      }
      return { success: false, error: err.message || "Failed to extract problem details from AI provider." }
    }
  }

  public async generateSolution(
    request: GenerateSolutionRequest
  ): Promise<ProviderResult<string>> {
    if (!this.client) {
      return {
        success: false,
        error: `${this.provider === "custom" ? "Custom/OpenAI" : "OpenAI"} API key not configured. Please check your settings.`
      }
    }

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content:
            "You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations."
        },
        { role: "user", content: request.promptText }
      ]

      const payload = this.buildCompletionPayload(request.model || "gpt-4o", messages, request)
      const solutionResponse = await this.client.chat.completions.create(payload, { signal: request.signal })

      const responseContent = solutionResponse.choices[0]?.message?.content
      const responseText =
        typeof responseContent === "string" ? responseContent : ""

      if (!responseText) {
        return {
          success: false,
          error: "Failed to generate solution. No response from AI provider."
        }
      }

      return { success: true, data: responseText }
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number }
      if (err.status === 401) {
        return { success: false, error: "Invalid API key provided. Please check your API settings." }
      }
      if (err.status === 429) {
        return { success: false, error: "API rate limit exceeded or quota exhausted. Please check your account limits." }
      }
      return { success: false, error: err.message || "Failed to generate solution from AI provider." }
    }
  }

  public async generateDebug(
    request: GenerateDebugRequest
  ): Promise<ProviderResult<string>> {
    if (!this.client) {
      return {
        success: false,
        error: `${this.provider === "custom" ? "Custom/OpenAI" : "OpenAI"} API key not configured. Please check your settings.`
      }
    }

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        {
          role: "system",
          content:
            "Follow the user's required debug report format exactly. Do not skip section headers."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: request.debugPrompt
            },
            ...request.imageDataList.map((data) => ({
              type: "image_url" as const,
              image_url: { url: `data:image/png;base64,${data}` }
            }))
          ]
        }
      ]

      const payload = this.buildCompletionPayload(request.model || "gpt-4o", messages, request)
      const debugResponse = await this.client.chat.completions.create(payload, { signal: request.signal })

      const responseContent = debugResponse.choices[0]?.message?.content
      const responseText =
        typeof responseContent === "string" ? responseContent : ""

      if (!responseText) {
        return {
          success: false,
          error: "Failed to generate debug analysis. No response from AI provider."
        }
      }

      return { success: true, data: responseText }
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number }
      if (err.status === 401) {
        return { success: false, error: "Invalid API key provided. Please check your API settings." }
      }
      if (err.status === 429) {
        return { success: false, error: "API rate limit exceeded or quota exhausted. Please check your account limits." }
      }
      return { success: false, error: err.message || "Failed to generate debug analysis from AI provider." }
    }
  }
}

