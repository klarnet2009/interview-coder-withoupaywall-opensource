import { AnthropicProcessingProvider } from "./providers/AnthropicProcessingProvider"
import { GeminiProcessingProvider } from "./providers/GeminiProcessingProvider"
import { OpenAIProcessingProvider } from "./providers/OpenAIProcessingProvider"
import type {
  ApiProvider,
  ProcessingProviderStrategy,
  ProviderConfig
} from "./types"

const toSignature = (config: ProviderConfig): string => {
  return JSON.stringify({
    apiProvider: config.apiProvider,
    apiKey: config.apiKey || "",
    extractionModel: config.extractionModel || "",
    solutionModel: config.solutionModel || "",
    debuggingModel: config.debuggingModel || ""
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

    this.provider = this.createProvider(config.apiProvider, config.apiKey)
    this.signature = nextSignature
    console.log(`Processing provider initialized: ${config.apiProvider}`)
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
    apiKey?: string
  ): ProcessingProviderStrategy {
    if (provider === "openai") {
      return new OpenAIProcessingProvider(apiKey)
    }
    if (provider === "anthropic") {
      return new AnthropicProcessingProvider(apiKey)
    }
    return new GeminiProcessingProvider(apiKey)
  }
}
