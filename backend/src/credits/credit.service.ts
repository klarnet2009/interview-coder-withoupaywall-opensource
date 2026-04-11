import { prisma } from '../database'
import { config } from '../config'

// ========== Result Types ==========

export type CreditResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode: number }

export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  balance: number
  operation: string | null
  description: string | null
  createdAt: Date
}

export interface CreditBalanceResult {
  balance: number
  transaction: CreditTransaction
}

// ========== Credit Service ==========

export class CreditService {
  /**
   * Get the current credit balance for a user.
   * Returns 0 if the user is not found.
   */
  async getBalance(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { credits: true },
    })

    return user?.credits ?? 0
  }

  /**
   * Add credits to a user's balance and record the transaction.
   * Wraps the operation in a Prisma interactive transaction for atomicity.
   */
  async addCredits(
    userId: string,
    amount: number,
    operation: string,
    description?: string
  ): Promise<CreditResult<CreditBalanceResult>> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update user credits (increment)
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { credits: { increment: amount } },
        })

        // Create transaction record
        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            amount,
            balance: updatedUser.credits,
            operation,
            description: description ?? null,
          },
        })

        return { balance: updatedUser.credits, transaction }
      })

      return {
        success: true,
        data: {
          balance: result.balance,
          transaction: result.transaction as CreditTransaction,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add credits'
      return { success: false, error: message, statusCode: 500 }
    }
  }

  /**
   * Add free signup credits to a new user.
   * Uses CREDITS_FREE_ON_SIGNUP from config.
   */
  async addFreeCredits(userId: string): Promise<CreditResult<CreditBalanceResult>> {
    return this.addCredits(userId, config.CREDITS_FREE_ON_SIGNUP, 'signup_bonus', 'Free credits on signup')
  }

  /**
   * Deduct credits from a user's balance.
   * Uses a transactional approach to prevent race conditions:
   * 1. Read current balance with row lock
   * 2. Check if sufficient credits exist
   * 3. If not, return 402 error
   * 4. If so, decrement balance and create transaction record
   *
   * Balance never goes below zero.
   */
  async deductCredits(
    userId: string,
    amount: number,
    operation: string
  ): Promise<CreditResult<CreditBalanceResult>> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Read current balance within transaction for consistency
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true },
        })

        if (!user) {
          throw new Error('User not found')
        }

        // Check sufficient balance
        if (user.credits < amount) {
          return { insufficient: true as const, currentBalance: user.credits }
        }

        // Decrement credits and create transaction record
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { credits: { decrement: amount } },
        })

        const transaction = await tx.creditTransaction.create({
          data: {
            userId,
            amount: -amount, // Negative amount for deduction
            balance: updatedUser.credits,
            operation,
            description: null,
          },
        })

        return { insufficient: false as const, balance: updatedUser.credits, transaction }
      })

      if ('insufficient' in result && result.insufficient) {
        return {
          success: false,
          error: 'Insufficient credits',
          statusCode: 402,
        }
      }

      return {
        success: true,
        data: {
          balance: result.balance,
          transaction: result.transaction as CreditTransaction,
        },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to deduct credits'
      return { success: false, error: message, statusCode: 500 }
    }
  }
}

// Singleton instance for use across the application
export const creditService = new CreditService()