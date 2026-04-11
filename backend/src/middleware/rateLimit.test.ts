import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock config before importing modules that depend on it
vi.mock('../config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret-for-rate-limit',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-for-rate-limit',
    PORT: 3001,
    NODE_ENV: 'test' as const,
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    RATE_LIMIT_WINDOW_MS: 100, // Short window for fast tests
    RATE_LIMIT_MAX_REQUESTS: 3, // Low limit for fast tests
  },
}))

import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'
import { rateLimiter } from './rateLimit'
import { authenticate } from './auth.middleware'

/**
 * Helper: create a fresh Express app with auth + rate limiting.
 * Each test uses a unique userId to avoid rate limit bucket collisions.
 */
function createApp(): express.Application {
  const app = express()
  app.use(express.json())
  app.use(authenticate, rateLimiter)
  app.post('/test-endpoint', (_req, res) => {
    res.json({ success: true })
  })
  return app
}

function makeToken(userId: string): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '1h' })
}

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('allows requests within limit', () => {
    it('should allow requests within the rate limit to pass through', async () => {
      const app = createApp()
      const token = makeToken('rate-allow-user')

      // Should allow up to RATE_LIMIT_MAX_REQUESTS
      for (let i = 0; i < config.RATE_LIMIT_MAX_REQUESTS; i++) {
        const response = await request(app)
          .post('/test-endpoint')
          .set('Authorization', `Bearer ${token}`)
        expect(response.status).toBe(200)
      }
    })

    it('should include RateLimit headers in responses', async () => {
      const app = createApp()
      const token = makeToken('rate-header-user')

      const response = await request(app)
        .post('/test-endpoint')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(200)
      // express-rate-limit uses standard RateLimit-* headers
      expect(response.headers['ratelimit-limit']).toBeDefined()
      expect(response.headers['ratelimit-remaining']).toBeDefined()
    })
  })

  describe('blocks requests exceeding limit', () => {
    it('should return 429 when rate limit is exceeded', async () => {
      const app = createApp()
      const token = makeToken('rate-block-user')

      // Send requests up to the limit
      for (let i = 0; i < config.RATE_LIMIT_MAX_REQUESTS; i++) {
        await request(app)
          .post('/test-endpoint')
          .set('Authorization', `Bearer ${token}`)
      }

      // The next request should be blocked
      const response = await request(app)
        .post('/test-endpoint')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(429)
      expect(response.body).toHaveProperty('error')
    })

    it('should return a clear error message when rate limited', async () => {
      const app = createApp()
      const token = makeToken('rate-message-user')

      // Exhaust the rate limit
      for (let i = 0; i < config.RATE_LIMIT_MAX_REQUESTS; i++) {
        await request(app)
          .post('/test-endpoint')
          .set('Authorization', `Bearer ${token}`)
      }

      const response = await request(app)
        .post('/test-endpoint')
        .set('Authorization', `Bearer ${token}`)

      expect(response.status).toBe(429)
      expect(response.body.error).toBe('Too many requests. Please try again later.')
    })
  })

  describe('uses userId as rate limit key', () => {
    it('should track rate limits per user (different users have separate limits)', async () => {
      const app = createApp()
      const user1Token = makeToken('user-separate-1')
      const user2Token = makeToken('user-separate-2')

      // Exhaust rate limit for user 1
      for (let i = 0; i < config.RATE_LIMIT_MAX_REQUESTS; i++) {
        await request(app)
          .post('/test-endpoint')
          .set('Authorization', `Bearer ${user1Token}`)
      }

      // User 1 should be rate limited
      const response1 = await request(app)
        .post('/test-endpoint')
        .set('Authorization', `Bearer ${user1Token}`)
      expect(response1.status).toBe(429)

      // User 2 should still be allowed
      const response2 = await request(app)
        .post('/test-endpoint')
        .set('Authorization', `Bearer ${user2Token}`)
      expect(response2.status).toBe(200)
    })
  })

  describe('rate limit window resets', () => {
    it('should allow requests again after the time window expires', async () => {
      const app = createApp()
      const token = makeToken('rate-reset-user')

      // Exhaust the rate limit
      for (let i = 0; i < config.RATE_LIMIT_MAX_REQUESTS; i++) {
        await request(app)
          .post('/test-endpoint')
          .set('Authorization', `Bearer ${token}`)
      }

      // Confirm rate limited
      const blockedResponse = await request(app)
        .post('/test-endpoint')
        .set('Authorization', `Bearer ${token}`)
      expect(blockedResponse.status).toBe(429)

      // Wait for the rate limit window to expire (100ms in test config)
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should be allowed again
      const allowedResponse = await request(app)
        .post('/test-endpoint')
        .set('Authorization', `Bearer ${token}`)
      expect(allowedResponse.status).toBe(200)
    }, 10000) // Extend timeout for this test
  })
})