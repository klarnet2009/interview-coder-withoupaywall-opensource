import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config'

/**
 * Extend Express Request type to include user data from JWT.
 */
export interface AuthRequest extends Request {
  user?: {
    userId: string
  }
}

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and sets req.user with the decoded token payload.
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  // Check for Authorization header with Bearer format
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access token required' })
    return
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string }
    req.user = { userId: decoded.userId }
    next()
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Access token expired' })
      return
    }
    res.status(401).json({ error: 'Invalid access token' })
    return
  }
}