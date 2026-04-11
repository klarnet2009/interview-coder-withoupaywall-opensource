import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock config module before any imports that use it
vi.mock('../config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    PORT: 3001,
    NODE_ENV: 'test',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    STRIPE_SECRET_KEY: 'sk_test_fake_key',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_SUCCESS_URL: 'https://interviewcoder.app/credits/success',
    STRIPE_CANCEL_URL: 'https://interviewcoder.app/credits/cancel',
    CREDIT_PACKAGES: '50:500,150:1200,500:4000',
  }
}))

import { OpenAIProcessingProvider } from './providers/openai.provider'
import { GeminiProcessingProvider } from './providers/gemini.provider'
import { AnthropicProcessingProvider } from './providers/anthropic.provider'
import { ProcessingService } from './processing.service'
import type { ProcessingResult, ProblemInfo } from './types'

// ========== ProcessingResult discriminated union narrowing ==========

describe('ProcessingResult discriminated union', () => {
  it('narrows correctly on success: true → data available', () => {
    const result: ProcessingResult<ProblemInfo> = {
      success: true,
      data: { problem_statement: 'test' }
    }
    if (result.success) {
      expect(result.data).toBeDefined()
      expect(result.data.problem_statement).toBe('test')
    }
  })

  it('narrows correctly on success: false → error and statusCode available', () => {
    const result: ProcessingResult<ProblemInfo> = {
      success: false,
      error: 'Not configured',
      statusCode: 503
    }
    if (!result.success) {
      expect(result.error).toBe('Not configured')
      expect(result.statusCode).toBe(503)
    }
  })

  it('does not allow accessing data on failed result (type narrowing)', () => {
    const result: ProcessingResult<string> = {
      success: false,
      error: 'API key missing',
      statusCode: 400
    }
    // TypeScript narrows: result.data is not accessible when success is false
    expect(result.success).toBe(false)
    expect(result.error).toBe('API key missing')
    expect(result.statusCode).toBe(400)
  })
})

// ========== OpenAI ProcessingProvider ==========

describe('OpenAIProcessingProvider', () => {
  it('returns isConfigured() === false when constructed without API key', () => {
    const provider = new OpenAIProcessingProvider('')
    expect(provider.isConfigured()).toBe(false)
  })

  it('returns isConfigured() === true when constructed with API key', () => {
    const provider = new OpenAIProcessingProvider('sk-test-key-123')
    expect(provider.isConfigured()).toBe(true)
  })

  it('provider type string is "openai"', () => {
    const provider = new OpenAIProcessingProvider('sk-test-key-123')
    expect(provider.provider).toBe('openai')
  })

  it('extractProblem returns error when not configured', async () => {
    const provider = new OpenAIProcessingProvider('')
    const result = await provider.extractProblem({
      imageDataList: ['base64data'],
      language: 'python'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })

  it('generateSolution returns error when not configured', async () => {
    const provider = new OpenAIProcessingProvider('')
    const result = await provider.generateSolution({
      promptText: 'Solve this problem'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })

  it('generateDebug returns error when not configured', async () => {
    const provider = new OpenAIProcessingProvider('')
    const result = await provider.generateDebug({
      debugPrompt: 'Debug this code',
      imageDataList: ['base64data']
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })
})

// ========== Gemini ProcessingProvider ==========

describe('GeminiProcessingProvider', () => {
  it('returns isConfigured() === false when constructed without API key', () => {
    const provider = new GeminiProcessingProvider('')
    expect(provider.isConfigured()).toBe(false)
  })

  it('returns isConfigured() === true when constructed with API key', () => {
    const provider = new GeminiProcessingProvider('gemini-test-key-123')
    expect(provider.isConfigured()).toBe(true)
  })

  it('provider type string is "gemini"', () => {
    const provider = new GeminiProcessingProvider('gemini-test-key-123')
    expect(provider.provider).toBe('gemini')
  })

  it('extractProblem returns error when not configured', async () => {
    const provider = new GeminiProcessingProvider('')
    const result = await provider.extractProblem({
      imageDataList: ['base64data'],
      language: 'python'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })

  it('generateSolution returns error when not configured', async () => {
    const provider = new GeminiProcessingProvider('')
    const result = await provider.generateSolution({
      promptText: 'Solve this'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })

  it('generateDebug returns error when not configured', async () => {
    const provider = new GeminiProcessingProvider('')
    const result = await provider.generateDebug({
      debugPrompt: 'Debug this',
      imageDataList: ['base64data']
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })
})

// ========== Anthropic ProcessingProvider ==========

describe('AnthropicProcessingProvider', () => {
  it('returns isConfigured() === false when constructed without API key', () => {
    const provider = new AnthropicProcessingProvider('')
    expect(provider.isConfigured()).toBe(false)
  })

  it('returns isConfigured() === true when constructed with API key', () => {
    const provider = new AnthropicProcessingProvider('sk-ant-test-key-123')
    expect(provider.isConfigured()).toBe(true)
  })

  it('provider type string is "anthropic"', () => {
    const provider = new AnthropicProcessingProvider('sk-ant-test-key-123')
    expect(provider.provider).toBe('anthropic')
  })

  it('extractProblem returns error when not configured', async () => {
    const provider = new AnthropicProcessingProvider('')
    const result = await provider.extractProblem({
      imageDataList: ['base64data'],
      language: 'python'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })

  it('generateSolution returns error when not configured', async () => {
    const provider = new AnthropicProcessingProvider('')
    const result = await provider.generateSolution({
      promptText: 'Solve this'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })

  it('generateDebug returns error when not configured', async () => {
    const provider = new AnthropicProcessingProvider('')
    const result = await provider.generateDebug({
      debugPrompt: 'Debug this',
      imageDataList: ['base64data']
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('not configured')
      expect(result.statusCode).toBe(503)
    }
  })
})

// ========== ProcessingService orchestrator ==========

describe('ProcessingService', () => {
  let service: ProcessingService

  beforeEach(() => {
    // Create service with mock config (all providers unconfigured)
    service = new ProcessingService({
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: ''
    })
  })

  it('getProvider throws for unknown provider type', () => {
    expect(() => service.getProvider('invalid' as any)).toThrow('Unknown provider: invalid')
  })

  it('getProvider throws for unconfigured openai provider', () => {
    expect(() => service.getProvider('openai')).toThrow(/not configured/i)
  })

  it('getProvider throws for unconfigured gemini provider', () => {
    expect(() => service.getProvider('gemini')).toThrow(/not configured/i)
  })

  it('getProvider throws for unconfigured anthropic provider', () => {
    expect(() => service.getProvider('anthropic')).toThrow(/not configured/i)
  })

  it('getProvider returns OpenAI provider instance when configured', () => {
    const configuredService = new ProcessingService({
      OPENAI_API_KEY: 'sk-test-key',
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: ''
    })
    const provider = configuredService.getProvider('openai')
    expect(provider).toBeInstanceOf(OpenAIProcessingProvider)
    expect(provider.provider).toBe('openai')
  })

  it('getProvider returns Gemini provider instance when configured', () => {
    const configuredService = new ProcessingService({
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: 'gemini-test-key',
      ANTHROPIC_API_KEY: ''
    })
    const provider = configuredService.getProvider('gemini')
    expect(provider).toBeInstanceOf(GeminiProcessingProvider)
    expect(provider.provider).toBe('gemini')
  })

  it('getProvider returns Anthropic provider instance when configured', () => {
    const configuredService = new ProcessingService({
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: 'sk-ant-test-key'
    })
    const provider = configuredService.getProvider('anthropic')
    expect(provider).toBeInstanceOf(AnthropicProcessingProvider)
    expect(provider.provider).toBe('anthropic')
  })

  it('extractProblem delegates to correct provider and returns error for unconfigured', async () => {
    const configuredService = new ProcessingService({
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: ''
    })
    // Unconfigured provider → should return error through service delegation
    const result = await configuredService.extractProblem('openai', {
      imageDataList: ['data'],
      language: 'python'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('OPENAI_API_KEY')
      expect(result.statusCode).toBe(400)
    }
  })

  it('generateSolution delegates to correct provider and returns error for unconfigured', async () => {
    const configuredService = new ProcessingService({
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: ''
    })
    const result = await configuredService.generateSolution('openai', {
      promptText: 'Solve this'
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('OPENAI_API_KEY')
    }
  })

  it('generateDebug delegates to correct provider and returns error for unconfigured', async () => {
    const configuredService = new ProcessingService({
      OPENAI_API_KEY: '',
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: ''
    })
    const result = await configuredService.generateDebug('openai', {
      debugPrompt: 'Debug this',
      imageDataList: ['data']
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('OPENAI_API_KEY')
    }
  })
})