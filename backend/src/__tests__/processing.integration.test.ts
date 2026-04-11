import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// Mock the database module before importing the app
vi.mock('../database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    creditTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

vi.mock('../config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret-for-integration',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-for-integration',
    PORT: 3001,
    NODE_ENV: 'test' as const,
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    CREDITS_FREE_ON_SIGNUP: 10,
    CREDITS_COST_EXTRACT: 1,
    CREDITS_COST_SOLUTION: 2,
    CREDITS_COST_DEBUG: 3,
    STRIPE_SECRET_KEY: 'sk_test_fake_key',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_SUCCESS_URL: 'https://interviewcoder.app/credits/success',
    STRIPE_CANCEL_URL: 'https://interviewcoder.app/credits/cancel',
    CREDIT_PACKAGES: '50:500,150:1200,500:4000',
  },
}))

// Mock processingService to avoid real AI API calls
vi.mock('../processing/processing.service', () => ({
  processingService: {
    extractProblem: vi.fn(),
    generateSolution: vi.fn(),
    generateDebug: vi.fn(),
  },
}))

// Mock creditService for credit check middleware
vi.mock('../credits/credit.service', () => ({
  creditService: {
    getBalance: vi.fn().mockResolvedValue(10),
    deductCredits: vi.fn().mockResolvedValue({
      success: true,
      data: { balance: 9, transaction: { id: 'txn-1', userId: 'proc-test-user', amount: -1, balance: 9, operation: 'extract', description: null, createdAt: new Date() } },
    }),
    addFreeCredits: vi.fn().mockResolvedValue({
      success: true,
      data: { balance: 10, transaction: { id: 'txn-free', userId: 'proc-test-user', amount: 10, balance: 10, operation: 'signup_bonus', description: 'Free credits on signup', createdAt: new Date() } },
    }),
  },
}))

import { app } from '../index'
import { config } from '../config'
import { processingService } from '../processing/processing.service'

function makeToken(userId = 'proc-test-user'): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '1h' })
}

describe('Processing Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const validExtractBody = {
    provider: 'openai',
    imageDataList: ['data:image/png;base64,abc123'],
    language: 'python',
  }

  const validSolutionBody = {
    provider: 'gemini',
    promptText: 'Solve this problem...',
  }

  const validDebugBody = {
    provider: 'anthropic',
    debugPrompt: 'Why does this code fail?',
    imageDataList: ['data:image/png;base64,abc123'],
  }

  // ─── Unauthenticated access ─────────────────────────────────────────

  describe('Unauthenticated requests', () => {
    it('POST /processing/extract without token returns 401', async () => {
      const response = await request(app)
        .post('/processing/extract')
        .send(validExtractBody)

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })

    it('POST /processing/solution without token returns 401', async () => {
      const response = await request(app)
        .post('/processing/solution')
        .send(validSolutionBody)

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })

    it('POST /processing/debug without token returns 401', async () => {
      const response = await request(app)
        .post('/processing/debug')
        .send(validDebugBody)

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error')
    })
  })

  // ─── Invalid token ──────────────────────────────────────────────────

  describe('Invalid token', () => {
    it('POST /processing/extract with invalid token returns 401', async () => {
      const response = await request(app)
        .post('/processing/extract')
        .set('Authorization', 'Bearer invalid-token-string')
        .send(validExtractBody)

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Invalid access token')
    })
  })

  // ─── Authenticated + valid requests ─────────────────────────────────

  describe('Authenticated valid requests', () => {
    it('POST /processing/extract with valid token returns 200 with data', async () => {
      vi.mocked(processingService.extractProblem).mockResolvedValueOnce({
        success: true,
        data: { problem_statement: 'Test problem', constraints: 'n <= 100' },
      })

      const response = await request(app)
        .post('/processing/extract')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send(validExtractBody)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('problem_statement', 'Test problem')
      expect(processingService.extractProblem).toHaveBeenCalledWith('openai', expect.objectContaining({
        imageDataList: ['data:image/png;base64,abc123'],
        language: 'python',
      }))
    })

    it('POST /processing/solution with valid token returns 200', async () => {
      vi.mocked(processingService.generateSolution).mockResolvedValueOnce({
        success: true,
        data: 'def solve(): pass',
      })

      const response = await request(app)
        .post('/processing/solution')
        .set('Authorization', `Bearer ${makeToken('sol-user')}`)
        .send(validSolutionBody)

      expect(response.status).toBe(200)
      expect(response.body).toBe('def solve(): pass')
      expect(processingService.generateSolution).toHaveBeenCalledWith('gemini', expect.objectContaining({
        promptText: 'Solve this problem...',
      }))
    })

    it('POST /processing/debug with valid token returns 200', async () => {
      vi.mocked(processingService.generateDebug).mockResolvedValueOnce({
        success: true,
        data: 'The issue is on line 3...',
      })

      const response = await request(app)
        .post('/processing/debug')
        .set('Authorization', `Bearer ${makeToken('dbg-user')}`)
        .send(validDebugBody)

      expect(response.status).toBe(200)
      expect(response.body).toBe('The issue is on line 3...')
      expect(processingService.generateDebug).toHaveBeenCalledWith('anthropic', expect.objectContaining({
        debugPrompt: 'Why does this code fail?',
        imageDataList: ['data:image/png;base64,abc123'],
      }))
    })
  })

  // ─── Input validation ───────────────────────────────────────────────

  describe('Input validation', () => {
    it('POST /processing/extract with invalid provider returns 400', async () => {
      const response = await request(app)
        .post('/processing/extract')
        .set('Authorization', `Bearer ${makeToken('val-user1')}`)
        .send({ ...validExtractBody, provider: 'invalid' })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    it('POST /processing/extract with missing imageDataList returns 400', async () => {
      const response = await request(app)
        .post('/processing/extract')
        .set('Authorization', `Bearer ${makeToken('val-user2')}`)
        .send({ provider: 'openai', language: 'python' })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    it('POST /processing/solution with missing promptText returns 400', async () => {
      const response = await request(app)
        .post('/processing/solution')
        .set('Authorization', `Bearer ${makeToken('val-user3')}`)
        .send({ provider: 'gemini' })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    it('POST /processing/debug with empty imageDataList returns 400', async () => {
      const response = await request(app)
        .post('/processing/debug')
        .set('Authorization', `Bearer ${makeToken('val-user4')}`)
        .send({ provider: 'openai', debugPrompt: 'help', imageDataList: [] })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })

    it('POST /processing/extract with wrong type for imageDataList returns 400', async () => {
      const response = await request(app)
        .post('/processing/extract')
        .set('Authorization', `Bearer ${makeToken('val-user5')}`)
        .send({ provider: 'openai', imageDataList: 'not-array', language: 'python' })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })
  })

  // ─── Processing service errors ──────────────────────────────────────

  describe('Processing service errors', () => {
    it('should return error status code when processing service fails', async () => {
      vi.mocked(processingService.extractProblem).mockResolvedValueOnce({
        success: false,
        error: 'Provider openai is not configured. Set the OPENAI_API_KEY environment variable.',
        statusCode: 503,
      })

      const response = await request(app)
        .post('/processing/extract')
        .set('Authorization', `Bearer ${makeToken('err-user1')}`)
        .send(validExtractBody)

      expect(response.status).toBe(503)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('not configured')
    })

    it('should return 500 when processing service returns no status code', async () => {
      vi.mocked(processingService.generateSolution).mockResolvedValueOnce({
        success: false,
        error: 'Unexpected error',
        statusCode: 500,
      })

      const response = await request(app)
        .post('/processing/solution')
        .set('Authorization', `Bearer ${makeToken('err-user2')}`)
        .send(validSolutionBody)

      expect(response.status).toBe(500)
      expect(response.body.error).toBe('Unexpected error')
    })
  })

  // ─── Rate limiting ──────────────────────────────────────────────────

  describe('Rate limiting', () => {
    it('should include rate limit headers in response', async () => {
      vi.mocked(processingService.extractProblem).mockResolvedValueOnce({
        success: true,
        data: { problem_statement: 'Test' },
      })

      const response = await request(app)
        .post('/processing/extract')
        .set('Authorization', `Bearer ${makeToken('rl-header-user')}`)
        .send(validExtractBody)

      expect(response.status).toBe(200)
      // Standard RateLimit headers from express-rate-limit
      expect(response.headers['ratelimit-limit']).toBeDefined()
      expect(response.headers['ratelimit-remaining']).toBeDefined()
    })
  })
})