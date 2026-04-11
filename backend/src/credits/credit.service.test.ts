import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module under test
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
  },
}))

import { creditService } from './credit.service'
import { prisma } from '../database'
import { config } from '../config'

describe('CreditService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getBalance', () => {
    it('should return current credit balance for a user', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hash',
        credits: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const balance = await creditService.getBalance('user-1')

      expect(balance).toBe(10)
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { credits: true },
      })
    })

    it('should return 0 if user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

      const balance = await creditService.getBalance('nonexistent-user')

      expect(balance).toBe(0)
    })

    it('should return 0 for a user with no credits', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'user-2',
        email: 'no@credits.com',
        passwordHash: 'hash',
        credits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const balance = await creditService.getBalance('user-2')

      expect(balance).toBe(0)
    })
  })

  describe('addCredits', () => {
    it('should add credits and create a CreditTransaction record', async () => {
      const mockTransaction = {
        id: 'txn-1',
        userId: 'user-1',
        amount: 10,
        balance: 10,
        operation: 'signup_bonus',
        description: 'Free signup credits',
        createdAt: new Date(),
      }

      // Mock the interactive transaction
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: Function) => {
        const mockTx = {
          user: {
            update: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              email: 'test@example.com',
              passwordHash: 'hash',
              credits: 10,
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          creditTransaction: {
            create: vi.fn().mockResolvedValueOnce(mockTransaction),
          },
        }
        return callback(mockTx)
      })

      const result = await creditService.addCredits('user-1', 10, 'signup_bonus', 'Free signup credits')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.balance).toBe(10)
        expect(result.data.transaction).toEqual(mockTransaction)
      }
    })

    it('should handle addCredits with custom description', async () => {
      const mockTransaction = {
        id: 'txn-2',
        userId: 'user-1',
        amount: 50,
        balance: 60,
        operation: 'purchase',
        description: 'Starter pack',
        createdAt: new Date(),
      }

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: Function) => {
        const mockTx = {
          user: {
            update: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: 60,
            }),
          },
          creditTransaction: {
            create: vi.fn().mockResolvedValueOnce(mockTransaction),
          },
        }
        return callback(mockTx)
      })

      const result = await creditService.addCredits('user-1', 50, 'purchase', 'Starter pack')

      expect(result.success).toBe(true)
    })
  })

  describe('addFreeCredits', () => {
    it('should call addCredits with CREDITS_FREE_ON_SIGNUP amount and signup_bonus operation', async () => {
      const mockTransaction = {
        id: 'txn-3',
        userId: 'user-1',
        amount: config.CREDITS_FREE_ON_SIGNUP,
        balance: config.CREDITS_FREE_ON_SIGNUP,
        operation: 'signup_bonus',
        description: 'Free credits on signup',
        createdAt: new Date(),
      }

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: Function) => {
        const mockTx = {
          user: {
            update: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: config.CREDITS_FREE_ON_SIGNUP,
            }),
          },
          creditTransaction: {
            create: vi.fn().mockResolvedValueOnce(mockTransaction),
          },
        }
        return callback(mockTx)
      })

      const result = await creditService.addFreeCredits('user-1')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.balance).toBe(config.CREDITS_FREE_ON_SIGNUP)
      }
    })
  })

  describe('deductCredits', () => {
    it('should deduct credits with sufficient balance and return new balance', async () => {
      const mockTransaction = {
        id: 'txn-4',
        userId: 'user-1',
        amount: -2,
        balance: 8,
        operation: 'solution',
        description: null,
        createdAt: new Date(),
      }

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: Function) => {
        const mockTx = {
          user: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: 10,
            }),
            update: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: 8,
            }),
          },
          creditTransaction: {
            create: vi.fn().mockResolvedValueOnce(mockTransaction),
          },
        }
        return callback(mockTx)
      })

      const result = await creditService.deductCredits('user-1', 2, 'solution')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.balance).toBe(8)
      }
    })

    it('should fail with 402 when balance is insufficient', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: Function) => {
        const mockTx = {
          user: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: 1,
            }),
          },
        }
        return callback(mockTx)
      })

      const result = await creditService.deductCredits('user-1', 2, 'solution')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(402)
        expect(result.error).toBe('Insufficient credits')
      }
    })

    it('should fail with 402 when balance is exactly zero', async () => {
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: Function) => {
        const mockTx = {
          user: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: 0,
            }),
          },
        }
        return callback(mockTx)
      })

      const result = await creditService.deductCredits('user-1', 1, 'extract')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(402)
      }
    })

    it('should never allow balance to go below zero (transactional)', async () => {
      // This test simulates a scenario where the balance check is atomic
      // within the transaction, preventing race conditions
      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: Function) => {
        const mockTx = {
          user: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: 3,
            }),
          },
        }
        // Attempt to deduct 5 when only 3 available - should fail without updating
        return callback(mockTx)
      })

      const result = await creditService.deductCredits('user-1', 5, 'debug')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(402)
      }
    })

    it('should deduct exact balance when amount equals balance', async () => {
      const mockTransaction = {
        id: 'txn-5',
        userId: 'user-1',
        amount: -10,
        balance: 0,
        operation: 'solution',
        description: null,
        createdAt: new Date(),
      }

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: Function) => {
        const mockTx = {
          user: {
            findUnique: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: 10,
            }),
            update: vi.fn().mockResolvedValueOnce({
              id: 'user-1',
              credits: 0,
            }),
          },
          creditTransaction: {
            create: vi.fn().mockResolvedValueOnce(mockTransaction),
          },
        }
        return callback(mockTx)
      })

      const result = await creditService.deductCredits('user-1', 10, 'solution')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.balance).toBe(0)
      }
    })
  })
})