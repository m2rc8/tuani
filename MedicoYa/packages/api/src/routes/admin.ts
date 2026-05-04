import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { Role } from '@prisma/client'

export function createAdminRouter(db: PrismaClient): Router {
  const router = Router()

  router.get(
    '/doctors/pending',
    requireAuth,
    requireRole(Role.admin),
    async (_req: Request, res: Response): Promise<void> => {
      const doctors = await db.doctor.findMany({
        where:   { approved_at: null },
        include: { user: { select: { name: true, phone: true } } },
      })
      res.json(doctors)
    }
  )

  router.put(
    '/doctors/:id/approve',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response): Promise<void> => {
      const doctor = await db.doctor.update({
        where: { id: req.params.id },
        data:  { approved_at: new Date() },
      })
      res.json(doctor)
    }
  )

  return router
}
