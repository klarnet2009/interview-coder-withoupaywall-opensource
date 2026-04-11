import { Router, Request, Response } from 'express'
import { authService } from './auth.service'

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