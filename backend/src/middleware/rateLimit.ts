import rateLimit from 'express-rate-limit'
import { config } from '../config'
import type { AuthRequest } from './auth.middleware'

/**
 * Per-user rate limiting middleware using express-rate-limit.
 * 
 * Uses the authenticated user's userId as the rate limit key (not IP address),
 * so each user gets their own rate limit bucket.
 * 
 * Skip if the request is not authenticated (auth middleware handles 401 rejection).
 * Returns X-RateLimit-* headers for client awareness.
 */
export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  keyGenerator: (req: AuthRequest) => req.user?.userId || 'anonymous',
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,    // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,      // Disable `X-RateLimit-*` headers (use standard)
  skip: (req: AuthRequest) => !req.user, // Skip if not authenticated (auth middleware handles rejection)
})