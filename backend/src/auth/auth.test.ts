import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module under test
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
  },
  connectDatabase: vi.fn(),
  disconnectDatabase: vi.fn(),
}))

vi.mock('../config', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-jwt-secret-for-auth-tests',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-for-auth-tests',
    PORT: 3001,
    NODE_ENV: 'test',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    STRIPE_SECRET_KEY: 'sk_test_fake_key',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_secret',
    STRIPE_SUCCESS_URL: 'https://interviewcoder.app/credits/success',
    STRIPE_CANCEL_URL: 'https://interviewcoder.app/credits/cancel',
    CREDIT_PACKAGES: '50:500,150:1200,500:4000',
  },
}))

vi.mock('../credits/credit.service', () => ({
  creditService: {
    addFreeCredits: vi.fn().mockResolvedValue({
      success: true,
      data: { balance: 10, transaction: { id: 'txn-free', userId: 'user-uuid-1', amount: 10, balance: 10, operation: 'signup_bonus', description: 'Free credits on signup', createdAt: new Date() } },
    }),
  },
}))

import { authService } from './auth.service'
import { prisma } from '../database'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { config } from '../config'

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('register', () => {
    it('should register a new user and return 201 with tokens', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        credits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser)
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({
        id: 'rt-id-1',
        token: 'refresh-token-value',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      })

      const result = await authService.register({
        email: 'test@example.com',
        password: 'password123',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.user).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          createdAt: mockUser.createdAt,
        })
        expect(result.data.accessToken).toBeDefined()
        expect(result.data.refreshToken).toBeDefined()

        // Verify access token contains userId
        const decoded = jwt.verify(result.data.accessToken, config.JWT_SECRET) as { userId: string }
        expect(decoded.userId).toBe(mockUser.id)
      }
    })

    it('should return 409 for duplicate email registration', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
        id: 'existing-user-id',
        email: 'existing@example.com',
        passwordHash: 'hash',
        credits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await authService.register({
        email: 'existing@example.com',
        password: 'password123',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Email already registered')
        expect(result.statusCode).toBe(409)
      }
    })

    it('should return 400 for invalid email format', async () => {
      const result = await authService.register({
        email: 'not-an-email',
        password: 'password123',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(400)
      }
    })

    it('should return 400 for password shorter than 8 characters', async () => {
      const result = await authService.register({
        email: 'test@example.com',
        password: 'short',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.statusCode).toBe(400)
      }
    })

    it('should hash password with bcryptjs before storing', async () => {
      const mockUser = {
        id: 'user-uuid-2',
        email: 'hash@example.com',
        passwordHash: 'hashed-password',
        credits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)
      vi.mocked(prisma.user.create).mockResolvedValueOnce(mockUser)
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({
        id: 'rt-id-2',
        token: 'refresh-token-value',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      })

      const hashSpy = vi.spyOn(bcrypt, 'hash')

      await authService.register({
        email: 'hash@example.com',
        password: 'password123',
      })

      expect(hashSpy).toHaveBeenCalledWith('password123', 12)
    })
  })

  describe('login', () => {
    it('should return 200 with tokens for valid credentials', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'login@example.com',
        passwordHash: await bcrypt.hash('password123', 12),
        credits: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({
        id: 'rt-id-3',
        token: 'refresh-token-value',
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      })

      const result = await authService.login({
        email: 'login@example.com',
        password: 'password123',
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.accessToken).toBeDefined()
        expect(result.data.refreshToken).toBeDefined()
      }
    })

    it('should return 401 for non-existent email', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

      const result = await authService.login({
        email: 'nonexistent@example.com',
        password: 'password123',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Invalid credentials')
        expect(result.statusCode).toBe(401)
      }
    })

    it('should return 401 for wrong password', async () => {
      const mockUser = {
        id: 'user-uuid-1',
        email: 'login@example.com',
        passwordHash: await bcrypt.hash('password123', 12),
        credits: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)

      const result = await authService.login({
        email: 'login@example.com',
        password: 'wrongpassword',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Invalid credentials')
        expect(result.statusCode).toBe(401)
      }
    })
  })

  describe('refreshToken', () => {
    it('should return new tokens and revoke old refresh token (token rotation)', async () => {
      const userId = 'user-uuid-1'
      const oldRefreshToken = jwt.sign(
        { userId, tokenId: 'old-token-id' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      )

      const mockStoredToken = {
        id: 'rt-id-4',
        token: oldRefreshToken,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
        user: { id: userId, email: 'test@example.com', passwordHash: 'hash', credits: 0, createdAt: new Date(), updatedAt: new Date() },
      }

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(mockStoredToken)
      vi.mocked(prisma.refreshToken.update).mockResolvedValueOnce({ ...mockStoredToken, revokedAt: new Date() })
      vi.mocked(prisma.refreshToken.create).mockResolvedValueOnce({
        id: 'rt-id-5',
        token: 'new-refresh-token',
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      })

      const result = await authService.refreshToken({ refreshToken: oldRefreshToken })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.accessToken).toBeDefined()
        expect(result.data.refreshToken).toBeDefined()
      }

      // Verify old token was revoked (token rotation)
      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { token: oldRefreshToken },
          data: { revokedAt: expect.any(Date) },
        })
      )
    })

    it('should return 401 for invalid refresh token', async () => {
      const result = await authService.refreshToken({ refreshToken: 'invalid-token' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Invalid refresh token')
        expect(result.statusCode).toBe(401)
      }
    })

    it('should return 401 for revoked refresh token', async () => {
      const userId = 'user-uuid-1'
      const refreshToken = jwt.sign(
        { userId, tokenId: 'revoked-token-id' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      )

      const mockStoredToken = {
        id: 'rt-id-6',
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: new Date(), // Already revoked
        user: { id: userId, email: 'test@example.com', passwordHash: 'hash', credits: 0, createdAt: new Date(), updatedAt: new Date() },
      }

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(mockStoredToken)

      const result = await authService.refreshToken({ refreshToken })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Refresh token revoked')
        expect(result.statusCode).toBe(401)
      }
    })

    it('should return 401 for expired refresh token', async () => {
      const userId = 'user-uuid-1'
      // Create a token that's already expired
      const refreshToken = jwt.sign(
        { userId, tokenId: 'expired-token-id' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '1ms' }
      )

      // Wait a bit so the token expires
      await new Promise(resolve => setTimeout(resolve, 10))

      const result = await authService.refreshToken({ refreshToken })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Refresh token expired')
        expect(result.statusCode).toBe(401)
      }
    })
  })

  describe('logout', () => {
    it('should revoke the refresh token on logout', async () => {
      const mockStoredToken = {
        id: 'rt-id-7',
        token: 'some-refresh-token',
        userId: 'user-uuid-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        revokedAt: null,
      }

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(mockStoredToken)
      vi.mocked(prisma.refreshToken.update).mockResolvedValueOnce({
        ...mockStoredToken,
        revokedAt: new Date(),
      })

      const result = await authService.logout({ refreshToken: 'some-refresh-token' })

      expect(result.success).toBe(true)
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token' },
        data: { revokedAt: expect.any(Date) },
      })
    })

    it('should return success even if token not found (idempotent logout)', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValueOnce(null)

      const result = await authService.logout({ refreshToken: 'nonexistent-token' })

      expect(result.success).toBe(true)
    })
  })
})