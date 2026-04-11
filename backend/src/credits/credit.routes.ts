import { Router, Response } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import type { AuthRequest } from '../middleware/auth.middleware'
import { creditService } from './credit.service'

export const creditsRouter = Router()

// GET /credits/balance — returns the current credit balance for the authenticated user (requires auth)
creditsRouter.get('/balance', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const balance = await creditService.getBalance(userId)
  res.json({ credits: balance })
})