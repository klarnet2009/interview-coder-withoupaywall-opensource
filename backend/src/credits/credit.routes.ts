import { Router, Response } from 'express'
import { authenticate } from '../middleware/auth.middleware'
import type { AuthRequest } from '../middleware/auth.middleware'
import { creditService } from './credit.service'

export const creditsRouter = Router()

// All credit routes require authentication
creditsRouter.use(authenticate)

// GET /credits/balance — returns the current credit balance for the authenticated user
creditsRouter.get('/balance', async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const balance = await creditService.getBalance(userId)
  res.json({ credits: balance })
})