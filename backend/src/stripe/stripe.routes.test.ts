import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// Mock Stripe SDK constructor
const { mockCreateCheckoutSession, mockConstructEvent } = vi.hoisted(() => ({
  mockCreateCheckoutSession: vi.fn(),
  mockConstructEvent: vi.fn(),
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCreateCheckoutSession,
      },
    },
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  })),
}))

vi.mock('../database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    creditTransaction: {
      create: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    $transaction: vi.fn(),
  },
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

vi.mock('../config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret-for-stripe-routes',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-for-stripe-routes',
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
    addCredits: vi.fn().mockResolvedValue({
      success: true,
      data: { balance: 60, transaction: { id: 'txn-1', userId: 'stripe-user', amount: 50, balance: 60, operation: 'purchase', description: 'Credit purchase: credits_50', createdAt: new Date() } },
    }),
    addFreeCredits: vi.fn(),
    getBalance: vi.fn().mockResolvedValue(10),
    deductCredits: vi.fn(),
  },
}))

vi.mock('../processing/processing.service', () => ({
  processingService: {
    extractProblem: vi.fn(),
    generateSolution: vi.fn(),
    generateDebug: vi.fn(),
  },
}))

import { app } from '../index'
import { config } from '../config'
import { creditService } from '../credits/credit.service'

function makeToken(userId: string = 'stripe-route-user'): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '1h' })
}

describe('Stripe Routes Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /credits/checkout', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/credits/checkout')
        .send({ packageId: 'credits_50' })

      expect(response.status).toBe(401)
    })

    it('should create checkout session and return URL for valid packageId', async () => {
      const mockSessionUrl = 'https://checkout.stripe.com/mock-session-123'
      mockCreateCheckoutSession.mockResolvedValueOnce({
        url: mockSessionUrl,
      })

      const response = await request(app)
        .post('/credits/checkout')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ packageId: 'credits_50' })

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('url')
      expect(response.body.url).toBe(mockSessionUrl)
    })

    it('should return 400 for invalid packageId', async () => {
      const response = await request(app)
        .post('/credits/checkout')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ packageId: 'invalid_package' })

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Invalid package')
    })

    it('should return 400 for missing packageId in body', async () => {
      const response = await request(app)
        .post('/credits/checkout')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({})

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })
  })

  describe('GET /credits/packages', () => {
    it('should return available credit packages without authentication', async () => {
      const response = await request(app)
        .get('/credits/packages')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('packages')
      expect(response.body.packages).toHaveLength(3)
      expect(response.body.packages[0]).toEqual({
        id: 'credits_50',
        credits: 50,
        priceInCents: 500,
        name: '50 Credits',
      })
    })
  })

  describe('POST /stripe/webhook', () => {
    it('should process valid webhook event and add credits', async () => {
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_test_webhook',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test_webhook',
            metadata: { userId: 'webhook-user', packageId: 'credits_50' },
          },
        },
      } as never)

      const payload = JSON.stringify({
        type: 'checkout.session.completed',
        data: { object: { metadata: { userId: 'webhook-user', packageId: 'credits_50' } } },
      })

      const response = await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 't=123,v1=abc')
        .set('Content-Type', 'application/json')
        .send(payload)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('received', true)
      expect(creditService.addCredits).toHaveBeenCalledWith(
        'webhook-user',
        50,
        'purchase',
        'Credit purchase: credits_50'
      )
    })

    it('should return 400 with missing stripe-signature header', async () => {
      const response = await request(app)
        .post('/stripe/webhook')
        .set('Content-Type', 'application/json')
        .send('{"type":"test"}')

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
      expect(response.body.error).toContain('Missing Stripe signature')
    })

    it('should return 400 for invalid webhook signature', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('Invalid signature')
      })

      const response = await request(app)
        .post('/stripe/webhook')
        .set('stripe-signature', 'invalid_sig')
        .set('Content-Type', 'application/json')
        .send('{"type":"test"}')

      expect(response.status).toBe(400)
      expect(response.body).toHaveProperty('error')
    })
  })
})