import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'

const availabilitySchema = z.object({ available: z.boolean() })

export function createDoctorsRouter(db: PrismaClient): Router {
  const router = Router()

  router.get('/available', requireAuth, async (_req: Request, res: Response): Promise<void> => {
    const doctors = await db.doctor.findMany({
      where: {
        available:   true,
        approved_at: { not: null },
      },
      include: { user: { select: { name: true, phone: true } } },
    })
    res.json(doctors)
  })

  router.put(
    '/availability',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = availabilitySchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'available (boolean) is required' })
        return
      }
      const doctor = await db.doctor.update({
        where: { id: req.user!.sub },
        data:  { available: parsed.data.available },
      })
      res.json(doctor)
    }
  )

  return router
}
