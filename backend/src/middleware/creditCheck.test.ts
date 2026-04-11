import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Response, NextFunction } from 'express'

import type { AuthRequest } from '../middleware/auth.middleware'

// Mock creditService before importing the middleware
vi.mock('../credits/credit.service', () => ({
  creditService: {
    getBalance: vi.fn(),
  },
}))

import { creditCheck } from './creditCheck'
import { creditService } from '../credits/credit.service'

describe('creditCheck middleware', () => {
  let mockRequest: Partial<AuthRequest>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    vi.clearAllMocks()

    mockRequest = {
      user: { userId: 'user-1' },
    }
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }
    mockNext = vi.fn()
  })

  it('should call next() when user has sufficient credits', async () => {
    vi.mocked(creditService.getBalance).mockResolvedValueOnce(10)

    const middleware = creditCheck(2)
    await middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext)

    expect(creditService.getBalance).toHaveBeenCalledWith('user-1')
    expect(mockNext).toHaveBeenCalled()
    expect(mockResponse.status).not.toHaveBeenCalled()
  })

  it('should return 402 with descriptive error when balance is insufficient', async () => {
    vi.mocked(creditService.getBalance).mockResolvedValueOnce(1)

    const middleware = creditCheck(2)
    await middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockResponse.status).toHaveBeenCalledWith(402)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Insufficient credits. Current balance: 1, required: 2',
    })
  })

  it('should return 402 when balance is zero', async () => {
    vi.mocked(creditService.getBalance).mockResolvedValueOnce(0)

    const middleware = creditCheck(1)
    await middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockResponse.status).toHaveBeenCalledWith(402)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Insufficient credits. Current balance: 0, required: 1',
    })
  })

  it('should return 500 when req.user is missing (authenticate middleware not applied)', async () => {
    mockRequest = {} // No user property

    const middleware = creditCheck(1)
    await middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext)

    expect(mockNext).not.toHaveBeenCalled()
    expect(mockResponse.status).toHaveBeenCalledWith(500)
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: 'Authentication required before credit check',
    })
  })

  it('should allow exact balance (balance equals cost)', async () => {
    vi.mocked(creditService.getBalance).mockResolvedValueOnce(3)

    const middleware = creditCheck(3)
    await middleware(mockRequest as AuthRequest, mockResponse as Response, mockNext)

    expect(mockNext).toHaveBeenCalled()
    expect(mockResponse.status).not.toHaveBeenCalled()
  })
})