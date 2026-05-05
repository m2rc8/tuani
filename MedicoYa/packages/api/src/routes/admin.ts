import { Router, Request, Response, NextFunction } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/requireAuth'

export function createAdminRouter(db: PrismaClient): Router {
  const router = Router()

  router.get(
    '/doctors/pending',
    requireAuth,
    requireRole(Role.admin),
    async (_req: Request, res: Response): Promise<void> => {
      const doctors = await db.doctor.findMany({
        where:   { approved_at: null, rejected_at: null },
        include: { user: { select: { name: true, phone: true } } },
      })
      res.json(doctors)
    }
  )

  router.get(
    '/doctors/approved',
    requireAuth,
    requireRole(Role.admin),
    async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const doctors = await db.doctor.findMany({
          where:   { approved_at: { not: null }, rejected_at: null },
          include: { user: { select: { name: true, phone: true } } },
        })
        res.json(doctors)
      } catch (err) { next(err) }
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

  router.put(
    '/doctors/:id/reject',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const doctor = await db.doctor.update({
          where: { id: req.params.id },
          data:  { rejected_at: new Date() },
        })
        res.json(doctor)
      } catch {
        res.status(404).json({ error: 'Doctor not found' })
      }
    }
  )

  router.get(
    '/consultations',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const dateStr = typeof req.query.date === 'string'
        ? req.query.date
        : new Date().toISOString().split('T')[0]
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' })
        return
      }
      try {
        const start = new Date(`${dateStr}T00:00:00.000Z`)
        const end   = new Date(`${dateStr}T23:59:59.999Z`)
        const consultations = await db.consultation.findMany({
          where:   { created_at: { gte: start, lte: end } },
          include: {
            patient: { include: { user: { select: { name: true, phone: true } } } },
            doctor:  { include: { user: { select: { name: true, phone: true } } } },
          },
          orderBy: { created_at: 'desc' },
        })
        res.json(consultations)
      } catch (err) { next(err) }
    }
  )

  return router
}
