import dotenv from 'dotenv'
import { z } from 'zod'

// Load environment variables from .env file
dotenv.config()

/**
 * Environment configuration schema validated with Zod.
 * Required variables must be present; optional variables have defaults.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  // AI provider API keys — optional, stored server-side only, never exposed to clients
  OPENAI_API_KEY: z.string().optional().default(''),
  GEMINI_API_KEY: z.string().optional().default(''),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  // Rate limiting configuration
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),    // 1 minute window
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(20),      // 20 requests per window
  // Credits configuration
  CREDITS_FREE_ON_SIGNUP: z.coerce.number().default(10),      // Free credits given on signup (CRED-01)
  CREDITS_COST_EXTRACT: z.coerce.number().default(1),         // Cost per extract operation (CRED-03)
  CREDITS_COST_SOLUTION: z.coerce.number().default(2),        // Cost per solution operation (CRED-03)
  CREDITS_COST_DEBUG: z.coerce.number().default(3),           // Cost per debug operation (CRED-03)
  // Stripe configuration (CRED-02, PAY-01, PAY-02)
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, 'STRIPE_WEBHOOK_SECRET is required'),
  STRIPE_SUCCESS_URL: z.string().default('https://interviewcoder.app/credits/success'),
  STRIPE_CANCEL_URL: z.string().default('https://interviewcoder.app/credits/cancel'),
  CREDIT_PACKAGES: z.string().default('50:500,150:1200,500:4000'),  // format: "credits:price_in_cents"
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors
  const formatted = Object.entries(errors)
    .map(([field, messages]) => `${field}: ${messages?.join(', ')}`)
    .join('; ')
  throw new Error(`Missing or invalid environment variables: ${formatted}`)
}

export interface Config {
  DATABASE_URL: string
  JWT_SECRET: string
  JWT_REFRESH_SECRET: string
  PORT: number
  NODE_ENV: 'development' | 'production' | 'test'
  JWT_ACCESS_EXPIRES_IN: string
  JWT_REFRESH_EXPIRES_IN: string
  // AI provider API keys — optional, stored server-side only, never exposed to clients
  OPENAI_API_KEY: string
  GEMINI_API_KEY: string
  ANTHROPIC_API_KEY: string
  // Rate limiting configuration
  RATE_LIMIT_WINDOW_MS: number
  RATE_LIMIT_MAX_REQUESTS: number
  // Credits configuration
  CREDITS_FREE_ON_SIGNUP: number
  CREDITS_COST_EXTRACT: number
  CREDITS_COST_SOLUTION: number
  CREDITS_COST_DEBUG: number
  // Stripe configuration
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_SUCCESS_URL: string
  STRIPE_CANCEL_URL: string
  CREDIT_PACKAGES: string
}

export const config: Config = parsed.data