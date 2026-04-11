import { Response, NextFunction } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import { creditService } from '../credits/credit.service'

/**
 * Credit check middleware factory.
 * Returns Express middleware that checks if the user has sufficient credits
 * before allowing the request to proceed to the processing handler.
 *
 * If the user has insufficient credits, returns 402 Payment Required.
 * If the user is not authenticated (req.user missing), returns 500.
 *
 * @param operationCost - The number of credits required for this operation
 */
export function creditCheck(operationCost: number) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // req.user should always be set by the authenticate middleware
    // If it's missing, something went wrong with middleware ordering
    if (!req.user) {
      res.status(500).json({ error: 'Authentication required before credit check' })
      return
    }

    const userId = req.user.userId
    const balance = await creditService.getBalance(userId)

    if (balance < operationCost) {
      res.status(402).json({
        error: `Insufficient credits. Current balance: ${balance}, required: ${operationCost}`,
      })
      return
    }

    next()
  }
}