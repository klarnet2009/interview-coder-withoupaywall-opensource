import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { prisma } from '../database'
import { config } from '../config'

// ========== Validation Schemas ==========

const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

const logoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
})

// ========== Result Types ==========

export type AuthResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode: number }

export interface RegisterResponse {
  user: {
    id: string
    email: string
    createdAt: Date
  }
  accessToken: string
  refreshToken: string
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
}

export interface RefreshResponse {
  accessToken: string
  refreshToken: string
}

// ========== Helper Functions ==========

function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions)
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, tokenId: uuidv4() }, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions)
}

function calculateExpiryDate(): Date {
  // Parse JWT_REFRESH_EXPIRES_IN (e.g., '7d') and calculate expiry date
  const expiryStr = config.JWT_REFRESH_EXPIRES_IN
  const match = expiryStr.match(/^(\d+)([dhms])$/)
  if (!match) {
    // Default to 7 days if parsing fails
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }

  const value = parseInt(match[1], 10)
  const unit = match[2]
  const now = Date.now()

  switch (unit) {
    case 'd': return new Date(now + value * 24 * 60 * 60 * 1000)
    case 'h': return new Date(now + value * 60 * 60 * 1000)
    case 'm': return new Date(now + value * 60 * 1000)
    case 's': return new Date(now + value * 1000)
    default: return new Date(now + 7 * 24 * 60 * 60 * 1000)
  }
}

// ========== Auth Service ==========

export const authService = {
  async register(input: { email: string; password: string }): Promise<AuthResult<RegisterResponse>> {
    // Validate input
    const validation = registerSchema.safeParse(input)
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Validation failed'
      return { success: false, error: firstError, statusCode: 400 }
    }

    const { email, password } = validation.data

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return { success: false, error: 'Email already registered', statusCode: 409 }
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create user
    const user = await prisma.user.create({
      data: { email, passwordHash },
    })

    // Generate tokens
    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: calculateExpiryDate(),
      },
    })

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      },
    }
  },

  async login(input: { email: string; password: string }): Promise<AuthResult<LoginResponse>> {
    // Validate input
    const validation = loginSchema.safeParse(input)
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Validation failed'
      return { success: false, error: firstError, statusCode: 400 }
    }

    const { email, password } = validation.data

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return { success: false, error: 'Invalid credentials', statusCode: 401 }
    }

    // Compare password
    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return { success: false, error: 'Invalid credentials', statusCode: 401 }
    }

    // Generate tokens
    const accessToken = generateAccessToken(user.id)
    const refreshToken = generateRefreshToken(user.id)

    // Store refresh token in database
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: calculateExpiryDate(),
      },
    })

    return {
      success: true,
      data: {
        accessToken,
        refreshToken,
      },
    }
  },

  async refreshToken(input: { refreshToken: string }): Promise<AuthResult<RefreshResponse>> {
    // Validate input
    const validation = refreshSchema.safeParse(input)
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Validation failed'
      return { success: false, error: firstError, statusCode: 400 }
    }

    const { refreshToken } = validation.data

    // Verify the JWT refresh token
    let decoded: { userId: string; tokenId: string }
    try {
      decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as { userId: string; tokenId: string }
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        return { success: false, error: 'Refresh token expired', statusCode: 401 }
      }
      return { success: false, error: 'Invalid refresh token', statusCode: 401 }
    }

    // Find the token in database
    const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!storedToken) {
      return { success: false, error: 'Invalid refresh token', statusCode: 401 }
    }

    // Check if token is revoked
    if (storedToken.revokedAt) {
      return { success: false, error: 'Refresh token revoked', statusCode: 401 }
    }

    // Check if token is expired (double-check beyond JWT expiry)
    if (storedToken.expiresAt < new Date()) {
      return { success: false, error: 'Refresh token expired', statusCode: 401 }
    }

    // Token rotation: revoke the old token
    await prisma.refreshToken.update({
      where: { token: refreshToken },
      data: { revokedAt: new Date() },
    })

    // Generate new tokens
    const newAccessToken = generateAccessToken(decoded.userId)
    const newRefreshToken = generateRefreshToken(decoded.userId)

    // Store the new refresh token
    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: decoded.userId,
        expiresAt: calculateExpiryDate(),
      },
    })

    return {
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    }
  },

  async logout(input: { refreshToken: string }): Promise<AuthResult<{ message: string }>> {
    // Validate input
    const validation = logoutSchema.safeParse(input)
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || 'Validation failed'
      return { success: false, error: firstError, statusCode: 400 }
    }

    const { refreshToken } = validation.data

    // Find the token in database (idempotent: ok if not found)
    const storedToken = await prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (storedToken) {
      // Revoke the token
      await prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { revokedAt: new Date() },
      })
    }

    return {
      success: true,
      data: { message: 'Logged out successfully' },
    }
  },
}