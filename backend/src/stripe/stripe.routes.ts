import { Router, Response, Request } from 'express'
import { z } from 'zod'
import { authenticate } from '../middleware/auth.middleware'
import type { AuthRequest } from '../middleware/auth.middleware'
import { stripeService } from './stripe.service'

// ========== Checkout Routes (mounted at /credits) ==========

export const checkoutRouter = Router()

const checkoutSchema = z.object({
  packageId: z.string().min(1, 'packageId is required'),
})

// POST /credits/checkout — Create a Stripe Checkout session (authenticated)
checkoutRouter.post('/checkout', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = checkoutSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: parsed.error.flatten().fieldErrors,
    })
    return
  }

  const { packageId } = parsed.data
  const userId = req.user!.userId

  const result = await stripeService.createCheckoutSession(userId, packageId)

  if (!result.success) {
    res.status(result.statusCode).json({ error: result.error })
    return
  }

  res.json({ url: result.data.url })
})

// GET /credits/packages — List available credit packages (public)
checkoutRouter.get('/packages', (_req: Request, res: Response) => {
  const packages = stripeService.getCreditPackages()
  res.json({ packages })
})

// ========== Webhook Routes (mounted at /stripe) ==========

export const stripeWebhookRouter = Router()

// POST /stripe/webhook — Handle Stripe webhook events (unauthenticated)
// This route must receive raw body for signature verification
stripeWebhookRouter.post('/webhook', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string

  if (!sig) {
    res.status(400).json({ error: 'Missing Stripe signature header' })
    return
  }

  // req.body will be a Buffer when express.raw() middleware is used
  const payload = Buffer.isBuffer(req.body) ? req.body : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body))

  const result = await stripeService.handleWebhookEvent(payload, sig)

  if (!result.success) {
    res.status(result.statusCode).json({ error: result.error })
    return
  }

  res.json({ received: result.data.received })
})