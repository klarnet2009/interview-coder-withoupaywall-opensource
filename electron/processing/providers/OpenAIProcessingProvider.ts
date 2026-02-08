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
  public readonly provider = "openai" as const
  private readonly client: OpenAI | null

  constructor(apiKey?: string) {
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
  ): Promise<ProviderResult<ProblemInfo>> {
    if (!this.client) {
      return {
        success: false,
        error: "OpenAI API key not configured or invalid. Please check your settings."
      }
    }

    const messages = [
      {
        role: "system" as const,
        content:
          "You are a coding challenge interpreter. Analyze the screenshot of the coding problem and extract all relevant information. Return the information in JSON format with these fields: problem_statement, constraints, example_input, example_output. Just return the structured JSON without any other text."
      },
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `Extract the coding problem details from these screenshots. Return in JSON format. Preferred coding language we gonna use for this problem is ${request.language}.`
          },
          ...request.imageDataList.map((data) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${data}` }
          }))
        ]
      }
    ]

    const extractionResponse = await this.client.chat.completions.create({
      model: request.model || "gpt-4o",
      messages,
      max_tokens: 4000,
      temperature: 0.2
    })

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

    try {
      const jsonText = responseText.replace(/```json|```/g, "").trim()
      return {
        success: true,
        data: JSON.parse(jsonText) as ProblemInfo
      }
    } catch {
      return {
        success: false,
        error:
          "Failed to parse problem information. Please try again or use clearer screenshots."
      }
    }
  }

  public async generateSolution(
    request: GenerateSolutionRequest
  ): Promise<ProviderResult<string>> {
    if (!this.client) {
      return {
        success: false,
        error: "OpenAI API key not configured. Please check your settings."
      }
    }

    const solutionResponse = await this.client.chat.completions.create({
      model: request.model || "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are an expert coding interview assistant. Provide clear, optimal solutions with detailed explanations."
        },
        { role: "user", content: request.promptText }
      ],
      max_tokens: 4000,
      temperature: 0.2
    })

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
  }

  public async generateDebug(
    request: GenerateDebugRequest
  ): Promise<ProviderResult<string>> {
    if (!this.client) {
      return {
        success: false,
        error: "OpenAI API key not configured. Please check your settings."
      }
    }

    const messages = [
      {
        role: "system" as const,
        content:
          "Follow the user's required debug report format exactly. Do not skip section headers."
      },
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: request.debugPrompt
          },
          ...request.imageDataList.map((data) => ({
            type: "image_url" as const,
            image_url: { url: `data:image/png;base64,${data}` }
          }))
        ]
      }
    ]

    const debugResponse = await this.client.chat.completions.create({
      model: request.model || "gpt-4o",
      messages,
      max_tokens: 4000,
      temperature: 0.2
    })

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
  }
}
