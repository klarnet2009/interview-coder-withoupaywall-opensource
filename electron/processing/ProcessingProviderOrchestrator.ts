import { AnthropicProcessingProvider } from "./providers/AnthropicProcessingProvider"
import { GeminiProcessingProvider } from "./providers/GeminiProcessingProvider"
import { OpenAIProcessingProvider } from "./providers/OpenAIProcessingProvider"
import { createScopedLogger } from "../logger"
import type {
  ApiProvider,
  ProcessingProviderStrategy,
  ProviderConfig
} from "./types"

const runtimeLogger = createScopedLogger("processingProvider")

const toSignature = (config: ProviderConfig): string => {
  return JSON.stringify({
    apiProvider: config.apiProvider,
    apiKey: config.apiKey || "",
    baseUrl: config.baseUrl || "",
    extractionModel: config.extractionModel || "",
    solutionModel: config.solutionModel || "",
    debuggingModel: config.debuggingModel || "",
    temperature: config.temperature,
    reasoningEffort: config.reasoningEffort,
    maxTokens: config.maxTokens
  })
}

export class ProcessingProviderOrchestrator {
  private provider: ProcessingProviderStrategy | null = null
  private signature: string | null = null

  public sync(config: ProviderConfig): void {
    const nextSignature = toSignature(config)
    if (this.provider && this.signature === nextSignature) {
      return
    }

    this.provider = this.createProvider(config.apiProvider, config.apiKey, config.baseUrl)
    this.signature = nextSignature
    runtimeLogger.debug(`Processing provider initialized: ${config.apiProvider}`)
  }

  public getProvider(config: ProviderConfig): ProcessingProviderStrategy {
    this.sync(config)
    if (!this.provider) {
      throw new Error("Processing provider not initialized")
    }
    return this.provider
  }

  public isConfigured(config: ProviderConfig): boolean {
    return this.getProvider(config).isConfigured()
  }

  private createProvider(
    provider: ApiProvider,
    apiKey?: string,
    baseUrl?: string
  ): ProcessingProviderStrategy {
    if (provider === "openai") {
      return new OpenAIProcessingProvider(apiKey)
    }
    if (provider === "custom") {
      return new OpenAIProcessingProvider(apiKey, baseUrl || "https://openrouter.ai/api/v1", true)
    }
    if (provider === "anthropic") {
      return new AnthropicProcessingProvider(apiKey)
    }
    return new GeminiProcessingProvider(apiKey)
  }
}

