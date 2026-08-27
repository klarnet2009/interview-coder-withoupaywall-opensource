import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// Mock the database module before importing the app
vi.mock('../database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
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
    JWT_SECRET: 'test-jwt-secret-for-middleware-tests',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-for-middleware-tests',
    PORT: 3001,
    NODE_ENV: 'test',
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

vi.mock('../credits/credit.service', () => ({
  creditService: {
    getBalance: vi.fn().mockResolvedValue(10),
  },
}))

import { app } from '../index'
import { prisma } from '../database'
import { config } from '../config'

describe('Auth Middleware', () => {
  let validToken: string
  let expiredToken: string

  beforeEach(() => {
    vi.clearAllMocks()
    validToken = jwt.sign({ userId: 'test-user-id' }, config.JWT_SECRET, { expiresIn: '1h' })
    expiredToken = jwt.sign({ userId: 'test-user-id' }, config.JWT_SECRET, { expiresIn: '1ms' })
  })

  describe('authenticate middleware', () => {
    it('should allow request with valid Bearer token', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        createdAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as never)

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${validToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('id', mockUser.id)
      expect(response.body).toHaveProperty('email', mockUser.email)
    })

    it('should reject request without Authorization header with 401', async () => {
      const response = await request(app)
        .get('/auth/me')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Access token required')
    })

    it('should reject request with malformed Authorization header with 401', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'InvalidFormat')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Access token required')
    })

    it('should reject request with expired access token with 401', async () => {
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10))

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Access token expired')
    })

    it('should reject request with invalid access token with 401', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token-string')

      expect(response.status).toBe(401)
      expect(response.body).toHaveProperty('error', 'Invalid access token')
    })

    it('should set req.user on successful verification', async () => {
      // This test verifies that the middleware sets req.user by checking
      // the /auth/me endpoint returns user data for a valid token
      const mockUser = {
        id: 'user-verify-id',
        email: 'verify@example.com',
        createdAt: new Date('2026-01-01'),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as never)

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${validToken}`)

      expect(response.status).toBe(200)
      expect(response.body.id).toBe('user-verify-id')
      expect(response.body.email).toBe('verify@example.com')
    })

    it('should return 404 when authenticated user not found in database', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${validToken}`)

      expect(response.status).toBe(404)
      expect(response.body).toHaveProperty('error', 'User not found')
    })
  })
})