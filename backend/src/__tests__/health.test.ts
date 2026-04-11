import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

// Mock the database module before importing the app
vi.mock('../database', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

// Mock config to avoid needing real env vars
vi.mock('../config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
    PORT: 3001,
    NODE_ENV: 'test',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 20,
    CREDITS_FREE_ON_SIGNUP: 10,
    CREDITS_COST_EXTRACT: 1,
    CREDITS_COST_SOLUTION: 2,
    CREDITS_COST_DEBUG: 3,
  },
}))

describe('Health Check Endpoints', () => {
  let app: typeof import('../index').app

  beforeEach(async () => {
    vi.clearAllMocks()
    // Dynamic import to get fresh module
    const mod = await import('../index')
    app = mod.app
  })

  describe('GET /health', () => {
    it('should return 200 with status ok and a timestamp', async () => {
      const response = await request(app).get('/health')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('timestamp')
      expect(typeof response.body.timestamp).toBe('string')
      // Verify it's a valid ISO date string
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp)
    })
  })

  describe('GET /ready', () => {
    it('should return 200 with database connected when DB is healthy', async () => {
      const { prisma } = await import('../database')
      // Mock successful DB query
      vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ '?column?': 1 }])

      const response = await request(app).get('/ready')

      expect(response.status).toBe(200)
      expect(response.body).toEqual({
        status: 'ready',
        database: 'connected',
      })
    })

    it('should return 503 with database disconnected when DB connection fails', async () => {
      const { prisma } = await import('../database')
      // Mock DB query failure
      vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('Connection refused'))

      const response = await request(app).get('/ready')

      expect(response.status).toBe(503)
      expect(response.body).toEqual({
        status: 'not ready',
        database: 'disconnected',
      })
    })
  })
})