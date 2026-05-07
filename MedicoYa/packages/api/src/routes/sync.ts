import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { requireBrigadeMember } from '../middleware/requireBrigade'
import { BrigadeService } from '../services/BrigadeService'

const syncSchema = z.object({
  brigade_id: z.string().uuid(),
  consultations: z.array(z.object({
    local_id:      z.string().min(1),
    patient_phone: z.string().min(1),
    patient_name:  z.string().min(1),
    symptoms_text: z.string().optional(),
    diagnosis:     z.string().optional(),
    medications:   z.array(z.object({
      name:      z.string(),
      dose:      z.string(),
      frequency: z.string(),
    })).optional(),
    created_at: z.string().datetime(),
  })).min(0).max(100),
})

export function createSyncRouter(db: PrismaClient): Router {
  const router  = Router()
  const service = new BrigadeService(db)

  router.post(
    '/consultations',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = syncSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request body' }); return }

      const { brigade_id, consultations } = parsed.data

      const membership = await db.brigadeDoctor.findUnique({
        where: { brigade_id_doctor_id: { brigade_id, doctor_id: req.user!.sub } },
      })
      if (!membership) { res.status(403).json({ error: 'Forbidden' }); return }

      try {
        const result = await service.syncConsultations(req.user!.sub, brigade_id, consultations)
        res.json(result)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/brigade/:id',
    requireAuth,
    requireBrigadeMember(db),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const seed = await service.getBrigadeSeed(req.params.id)
        if (!seed) { res.status(404).json({ error: 'Brigade not found' }); return }
        res.json(seed)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  return router
}
