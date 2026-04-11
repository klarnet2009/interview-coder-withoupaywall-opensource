import { Router, Request, Response } from 'express'
import { authService } from './auth.service'
import { authenticate } from '../middleware/auth.middleware'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../database'

export const authRouter = Router()

// POST /auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const result = await authService.register(req.body)
    if (result.success) {
      res.status(201).json(result.data)
    } else {
      res.status(result.statusCode || 500).json({ error: result.error })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body)
    if (result.success) {
      res.status(200).json(result.data)
    } else {
      res.status(result.statusCode || 500).json({ error: result.error })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /auth/refresh
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const result = await authService.refreshToken(req.body)
    if (result.success) {
      res.status(200).json(result.data)
    } else {
      res.status(result.statusCode || 500).json({ error: result.error })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// POST /auth/logout
authRouter.post('/logout', async (req: Request, res: Response) => {
  try {
    const result = await authService.logout(req.body)
    if (result.success) {
      res.status(200).json(result.data)
    } else {
      res.status(result.statusCode || 500).json({ error: result.error })
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// GET /auth/me — protected route, returns current user data
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, email: true, createdAt: true },
    })
    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json(user)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})