import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to define mocks that are available when vi.mock factory runs
const { mockCreateCheckoutSession, mockConstructEvent } = vi.hoisted(() => ({
  mockCreateCheckoutSession: vi.fn(),
  mockConstructEvent: vi.fn(),
}))

// Mock Stripe SDK constructor before any imports
vi.mock('stripe', () => {
  return {
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
  }
})

vi.mock('../database', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    creditTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

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
    STRIPE_SECRET_KEY: 'sk_test_fake_key',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_SUCCESS_URL: 'https://interviewcoder.app/credits/success',
    STRIPE_CANCEL_URL: 'https://interviewcoder.app/credits/cancel',
    CREDIT_PACKAGES: '50:500,150:1200,500:4000',
  },
}))

vi.mock('../credits/credit.service', () => ({
  creditService: {
    addCredits: vi.fn(),
    addFreeCredits: vi.fn(),
    getBalance: vi.fn(),
    deductCredits: vi.fn(),
  },
}))

import { stripeService } from './stripe.service'
import { creditService } from '../credits/credit.service'

describe('StripeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCreditPackages', () => {
    it('should return parsed credit packages from config', () => {
      const packages = stripeService.getCreditPackages()

      expect(packages).toHaveLength(3)
      expect(packages[0]).toEqual({
        id: 'credits_50',
        credits: 50,
        priceInCents: 500,
        name: '50 Credits',
      })
      expect(packages[1]).toEqual({
        id: 'credits_150',
        credits: 150,
        priceInCents: 1200,
        name: '150 Credits',
      })
      expect(packages[2]).toEqual({
        id: 'credits_500',
        credits: 500,
        priceInCents: 4000,
        name: '500 Credits',
      })
    })
  })

  describe('createCheckoutSession', () => {
    it('should create checkout session and return URL for valid packageId', async () => {
      const mockSessionUrl = 'https://checkout.stripe.com/session-test-123'

      mockCreateCheckoutSession.mockResolvedValueOnce({
        url: mockSessionUrl,
      })

      const result = await stripeService.createCheckoutSession('user-1', 'credits_50')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.url).toBe(mockSessionUrl)
      }
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          success_url: 'https://interviewcoder.app/credits/success',
          cancel_url: 'https://interviewcoder.app/credits/cancel',
          metadata: { userId: 'user-1', packageId: 'credits_50' },
        })
      )
    })

    it('should reject invalid packageId with 400 error', async () => {
      const result = await stripeService.createCheckoutSession('user-1', 'invalid_package')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(400)
        expect(result.error).toContain('Invalid package')
      }
    })
  })

  describe('handleWebhookEvent', () => {
    it('should process checkout.session.completed event and add credits to user', async () => {
      vi.mocked(creditService.addCredits).mockResolvedValueOnce({
        success: true,
        data: {
          balance: 60,
          transaction: {
            id: 'txn-1',
            userId: 'user-1',
            amount: 50,
            balance: 60,
            operation: 'purchase',
            description: 'Credit purchase: credits_50',
            createdAt: new Date(),
          },
        },
      })

      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_test',
        object: 'event',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_test',
            metadata: { userId: 'user-1', packageId: 'credits_50' },
          },
        },
      } as never)

      const result = await stripeService.handleWebhookEvent(
        '{"type":"checkout.session.completed"}',
        't=123,v1=abc'
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.received).toBe(true)
      }
      expect(creditService.addCredits).toHaveBeenCalledWith(
        'user-1',
        50,
        'purchase',
        'Credit purchase: credits_50'
      )
    })

    it('should ignore non-checkout session event types', async () => {
      mockConstructEvent.mockReturnValueOnce({
        id: 'evt_test_other',
        object: 'event',
        type: 'invoice.paid',
        data: { object: {} },
      } as never)

      const result = await stripeService.handleWebhookEvent(
        '{"type":"invoice.paid"}',
        't=123,v1=abc'
      )

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.received).toBe(true)
      }
      // Should NOT call addCredits for non-checkout events
      expect(creditService.addCredits).not.toHaveBeenCalled()
    })

    it('should reject invalid webhook signature with 400 error', async () => {
      mockConstructEvent.mockImplementationOnce(() => {
        throw new Error('No signatures found matching the expected signature for payload')
      })

      const result = await stripeService.handleWebhookEvent(
        'invalid payload',
        'invalid_signature'
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(400)
        expect(result.error).toContain('Invalid signature')
      }
    })
  })
})