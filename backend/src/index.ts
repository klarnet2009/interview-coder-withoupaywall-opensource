import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { config } from './config'
import { prisma, connectDatabase, disconnectDatabase } from './database'
import { authRouter } from './auth/auth.routes'
import { processingRouter } from './processing/processing.routes'
import { creditsRouter } from './credits/credit.routes'
import { checkoutRouter, stripeWebhookRouter } from './stripe/stripe.routes'

const app = express()

// Middleware
app.use(helmet())
app.use(cors())

// Stripe webhook needs raw body — mount before express.json() middleware
app.use('/stripe', express.raw({ type: 'application/json' }), stripeWebhookRouter)

app.use(express.json())

// Health check - liveness probe (per BKND-01)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Readiness check - verifies DB connection (per BKND-01)
app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ready', database: 'connected' })
  } catch {
    res.status(503).json({ status: 'not ready', database: 'disconnected' })
  }
})

// Auth routes
app.use('/auth', authRouter)

// Credits routes (authenticated)
app.use('/credits', creditsRouter)

// Credits checkout and packages routes
app.use('/credits', checkoutRouter)

// Processing routes (authenticated + rate-limited)
app.use('/processing', processingRouter)

// Start server (only if not in test environment)
let server: ReturnType<typeof app.listen> | null = null

if (config.NODE_ENV !== 'test') {
  server = app.listen(config.PORT, async () => {
    console.log(`Server running on port ${config.PORT}`)
    try {
      await connectDatabase()
      console.log('Database connected')
    } catch (error) {
      console.error('Database connection failed:', error)
    }
  })

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...')
    server?.close()
    await disconnectDatabase()
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...')
    server?.close()
    await disconnectDatabase()
    process.exit(0)
  })
}

export { app, server }