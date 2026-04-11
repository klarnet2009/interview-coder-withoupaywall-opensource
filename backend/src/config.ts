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
}

export const config: Config = parsed.data