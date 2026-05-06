import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import Expo from 'expo-server-sdk'
import { requireAuth } from '../middleware/requireAuth'

const tokenSchema = z.object({ token: z.string().min(1).max(200) })

export function createNotificationsRouter(db: PrismaClient): Router {
  const router = Router()

  router.post(
    '/token',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = tokenSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'token is required' })
        return
      }
      if (!Expo.isExpoPushToken(parsed.data.token)) {
        res.status(400).json({ error: 'Invalid push token format' })
        return
      }
      try {
        await db.pushToken.upsert({
          where:  { token: parsed.data.token },
          create: { id: randomUUID(), user_id: req.user!.sub, token: parsed.data.token },
          update: { user_id: req.user!.sub, updated_at: new Date() },
        })
        res.status(204).send()
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  return router
}
