import { config } from '../config'
import type {
  ApiProvider,
  ExtractProblemRequest,
  GenerateDebugRequest,
  GenerateSolutionRequest,
  ProcessingResult,
  ProblemInfo,
  ProcessingProvider
} from './types'
import { OpenAIProcessingProvider } from './providers/openai.provider'
import { GeminiProcessingProvider } from './providers/gemini.provider'
import { AnthropicProcessingProvider } from './providers/anthropic.provider'

/**
 * High-level processing service that orchestrates provider selection
 * and exposes unified processing methods for extractProblem,
 * generateSolution, and generateDebug.
 *
 * Providers are initialized from config environment variables.
 * Unconfigured providers throw descriptive errors naming the missing env var.
 */
export class ProcessingService {
  private providers: Map<ApiProvider, ProcessingProvider>

  constructor(apiKeys?: { OPENAI_API_KEY: string; GEMINI_API_KEY: string; ANTHROPIC_API_KEY: string }) {
    this.providers = new Map()

    // Use provided API keys (for testing) or fall back to config (production)
    const openaiKey = apiKeys ? apiKeys.OPENAI_API_KEY : config.OPENAI_API_KEY
    const geminiKey = apiKeys ? apiKeys.GEMINI_API_KEY : config.GEMINI_API_KEY
    const anthropicKey = apiKeys ? apiKeys.ANTHROPIC_API_KEY : config.ANTHROPIC_API_KEY

    if (openaiKey) {
      this.providers.set('openai', new OpenAIProcessingProvider(openaiKey))
    }
    if (geminiKey) {
      this.providers.set('gemini', new GeminiProcessingProvider(geminiKey))
    }
    if (anthropicKey) {
      this.providers.set('anthropic', new AnthropicProcessingProvider(anthropicKey))
    }
  }

  /**
   * Get a provider instance by type string.
   * @throws Error if provider is unknown or not configured
   */
  getProvider(provider: ApiProvider): ProcessingProvider {
    const p = this.providers.get(provider)
    if (!p) {
      if (!['openai', 'gemini', 'anthropic'].includes(provider)) {
        throw new Error(`Unknown provider: ${provider}`)
      }
      const envVarMap: Record<string, string> = {
        openai: 'OPENAI_API_KEY',
        gemini: 'GEMINI_API_KEY',
        anthropic: 'ANTHROPIC_API_KEY'
      }
      throw new Error(
        `Provider ${provider} is not configured. Set the ${envVarMap[provider]} environment variable.`
      )
    }
    return p
  }

  /**
   * Extract a coding problem from screenshot images using the specified provider.
   */
  async extractProblem(
    provider: ApiProvider,
    request: ExtractProblemRequest
  ): Promise<ProcessingResult<ProblemInfo>> {
    try {
      const p = this.getProvider(provider)
      return await p.extractProblem(request)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        statusCode: 400
      }
    }
  }

  /**
   * Generate a solution for a coding problem using the specified provider.
   */
  async generateSolution(
    provider: ApiProvider,
    request: GenerateSolutionRequest
  ): Promise<ProcessingResult<string>> {
    try {
      const p = this.getProvider(provider)
      return await p.generateSolution(request)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        statusCode: 400
      }
    }
  }

  /**
   * Generate a debug analysis for code using the specified provider.
   */
  async generateDebug(
    provider: ApiProvider,
    request: GenerateDebugRequest
  ): Promise<ProcessingResult<string>> {
    try {
      const p = this.getProvider(provider)
      return await p.generateDebug(request)
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        statusCode: 400
      }
    }
  }
}

/**
 * Singleton instance initialized from environment config.
 * Providers that have no API key configured will not be available.
 */
export const processingService = new ProcessingService()