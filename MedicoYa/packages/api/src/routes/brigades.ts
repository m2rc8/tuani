import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { requireBrigadeOwner } from '../middleware/requireBrigade'
import { BrigadeService } from '../services/BrigadeService'

const createBrigadeSchema = z.object({
  name:         z.string().min(1).max(100),
  community:    z.string().min(1).max(100),
  municipality: z.string().max(100).optional(),
  department:   z.string().max(100).optional(),
  start_date:   z.string().datetime(),
  end_date:     z.string().datetime(),
})

export function createBrigadesRouter(db: PrismaClient): Router {
  const router  = Router()
  const service = new BrigadeService(db)

  router.post(
    '/',
    requireAuth,
    requireRole(Role.coordinator),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = createBrigadeSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request body' }); return }
      try {
        const brigade = await service.createBrigade(req.user!.sub, parsed.data)
        res.status(201).json(brigade)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const brigades = await service.getMyBrigades(req.user!.sub)
        res.json(brigades)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/by-code/:code',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const brigade = await service.getBrigadeByCode(req.params.code)
        if (!brigade) { res.status(404).json({ error: 'Brigade not found' }); return }
        res.json(brigade)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const brigade = await db.brigade.findUnique({
          where:   { id: req.params.id },
          include: {
            doctors: {
              include: { doctor: { include: { user: { select: { name: true } } } } },
            },
          },
        })
        if (!brigade) { res.status(404).json({ error: 'Brigade not found' }); return }

        const isOwner  = brigade.organizer_id === req.user!.sub
        const isMember = brigade.doctors.some(bd => bd.doctor_id === req.user!.sub)
        if (!isOwner && !isMember) { res.status(403).json({ error: 'Forbidden' }); return }

        res.json({
          ...brigade,
          doctors: brigade.doctors.map(bd => ({
            doctor_id: bd.doctor_id,
            name:      bd.doctor.user.name,
            joined_at: bd.joined_at,
          })),
        })
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.post(
    '/:id/join',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = z.object({ join_code: z.string().length(6) }).safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'join_code (6 chars) required' }); return }
      try {
        await service.joinBrigade(req.user!.sub, req.params.id, parsed.data.join_code)
        res.status(201).send()
      } catch (err: any) {
        if (err?.code === 'INVALID_CODE')   { res.status(400).json({ error: 'Invalid join code' }); return }
        if (err?.code === 'ALREADY_JOINED') { res.status(409).json({ error: 'Already joined' }); return }
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/:id/dashboard',
    requireAuth,
    requireBrigadeOwner(db),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const dashboard = await service.getDashboard(req.params.id)
        res.json(dashboard)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/:id/report',
    requireAuth,
    requireBrigadeOwner(db),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const report = await service.getReport(req.params.id)
        res.json(report)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  return router
}
