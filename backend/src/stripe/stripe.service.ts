import Stripe from 'stripe'
import { config } from '../config'
import { creditService } from '../credits/credit.service'

// ========== Result Types ==========

export type StripeResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; statusCode: number }

// ========== Credit Package Types ==========

export interface CreditPackage {
  id: string
  credits: number
  priceInCents: number
  name: string
}

// ========== Parse Credit Packages ==========

function parseCreditPackages(packagesStr: string): CreditPackage[] {
  return packagesStr.split(',').map((pkg) => {
    const [creditsStr, priceStr] = pkg.trim().split(':')
    const credits = parseInt(creditsStr, 10)
    const priceInCents = parseInt(priceStr, 10)
    const id = `credits_${credits}`
    return {
      id,
      credits,
      priceInCents,
      name: `${credits} Credits`,
    }
  })
}

const creditPackages = parseCreditPackages(config.CREDIT_PACKAGES)

// ========== Stripe Service ==========

const stripe = new Stripe(config.STRIPE_SECRET_KEY)

export class StripeService {
  /**
   * Get available credit packages.
   */
  getCreditPackages(): CreditPackage[] {
    return creditPackages
  }

  /**
   * Create a Stripe Checkout session for purchasing credits.
   * Validates the packageId against available packages and creates
   * a payment session with Stripe.
   */
  async createCheckoutSession(
    userId: string,
    packageId: string
  ): Promise<StripeResult<{ url: string }>> {
    // Validate packageId
    const pkg = creditPackages.find((p) => p.id === packageId)
    if (!pkg) {
      return {
        success: false,
        error: `Invalid package: ${packageId}. Available packages: ${creditPackages.map((p) => p.id).join(', ')}`,
        statusCode: 400,
      }
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: pkg.priceInCents,
              product_data: {
                name: pkg.name,
                description: `${pkg.credits} credits for Interview Coder`,
              },
            },
            quantity: 1,
          },
        ],
        success_url: config.STRIPE_SUCCESS_URL,
        cancel_url: config.STRIPE_CANCEL_URL,
        metadata: {
          userId,
          packageId,
        },
      })

      return {
        success: true,
        data: { url: session.url! },
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create checkout session'
      return {
        success: false,
        error: message,
        statusCode: 500,
      }
    }
  }

  /**
   * Handle a Stripe webhook event.
   * Verifies the webhook signature to prevent tampering,
   * then processes the event based on its type.
   *
   * For checkout.session.completed events, credits are added
   * to the user's account immediately.
   */
  async handleWebhookEvent(
    payload: string | Buffer,
    sig: string
  ): Promise<StripeResult<{ received: boolean }>> {
    let event: ReturnType<typeof stripe.webhooks.constructEvent>

    try {
      event = stripe.webhooks.constructEvent(
        payload,
        sig,
        config.STRIPE_WEBHOOK_SECRET
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid signature'
      return {
        success: false,
        error: `Invalid signature: ${message}`,
        statusCode: 400,
      }
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as { metadata?: { userId?: string; packageId?: string } }
        const userId = session.metadata?.userId
        const packageId = session.metadata?.packageId

        if (userId && packageId) {
          const pkg = creditPackages.find((p) => p.id === packageId)
          if (pkg) {
            await creditService.addCredits(
              userId,
              pkg.credits,
              'purchase',
              `Credit purchase: ${packageId}`
            )
          }
        }
        break
      }

      default:
        // Log other event types but don't take action
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }

    return {
      success: true,
      data: { received: true },
    }
  }
}

// Singleton instance for use across the application
export const stripeService = new StripeService()