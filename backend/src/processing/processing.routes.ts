import { Router, Response } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import type { AuthRequest } from '../middleware/auth.middleware'
import { rateLimiter } from '../middleware/rateLimit'
import { creditCheck } from '../middleware/creditCheck'
import { processingService } from './processing.service'
import { creditService } from '../credits/credit.service'
import { config } from '../config'
import type { ApiProvider } from './types'

export const processingRouter = Router()

// All processing routes require authentication and rate limiting
processingRouter.use(authenticate)
processingRouter.use(rateLimiter)

// Zod input validation schemas for each endpoint
const extractSchema = z.object({
  provider: z.enum(['openai', 'gemini', 'anthropic']),
  imageDataList: z.array(z.string()).min(1, 'At least one image is required'),
  language: z.string().min(1),
  model: z.string().optional(),
})

const solutionSchema = z.object({
  provider: z.enum(['openai', 'gemini', 'anthropic']),
  promptText: z.string().min(1),
  model: z.string().optional(),
})

const debugSchema = z.object({
  provider: z.enum(['openai', 'gemini', 'anthropic']),
  debugPrompt: z.string().min(1),
  imageDataList: z.array(z.string()).min(1, 'At least one image is required'),
  model: z.string().optional(),
})

// POST /processing/extract — Extract problem from screenshots
processingRouter.post('/extract', creditCheck(config.CREDITS_COST_EXTRACT), async (req: AuthRequest, res: Response) => {
  const validation = extractSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({ error: validation.error.issues[0]?.message || 'Validation failed' })
    return
  }
  const { provider, ...requestData } = validation.data
  const result = await processingService.extractProblem(provider as ApiProvider, requestData)
  if (result.success) {
    // Deduct credits after successful processing
    await creditService.deductCredits(req.user!.userId, config.CREDITS_COST_EXTRACT, 'extract')
    res.status(200).json(result.data)
  } else {
    res.status(result.statusCode || 500).json({ error: result.error })
  }
})

// POST /processing/solution — Generate solution for a problem
processingRouter.post('/solution', creditCheck(config.CREDITS_COST_SOLUTION), async (req: AuthRequest, res: Response) => {
  const validation = solutionSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({ error: validation.error.issues[0]?.message || 'Validation failed' })
    return
  }
  const { provider, ...requestData } = validation.data
  const result = await processingService.generateSolution(provider as ApiProvider, requestData)
  if (result.success) {
    // Deduct credits after successful processing
    await creditService.deductCredits(req.user!.userId, config.CREDITS_COST_SOLUTION, 'solution')
    res.status(200).json(result.data)
  } else {
    res.status(result.statusCode || 500).json({ error: result.error })
  }
})

// POST /processing/debug — Generate debug analysis
processingRouter.post('/debug', creditCheck(config.CREDITS_COST_DEBUG), async (req: AuthRequest, res: Response) => {
  const validation = debugSchema.safeParse(req.body)
  if (!validation.success) {
    res.status(400).json({ error: validation.error.issues[0]?.message || 'Validation failed' })
    return
  }
  const { provider, ...requestData } = validation.data
  const result = await processingService.generateDebug(provider as ApiProvider, requestData)
  if (result.success) {
    // Deduct credits after successful processing
    await creditService.deductCredits(req.user!.userId, config.CREDITS_COST_DEBUG, 'debug')
    res.status(200).json(result.data)
  } else {
    res.status(result.statusCode || 500).json({ error: result.error })
  }
})