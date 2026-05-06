import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { PrismaClient, ConsultationStatus, Role } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/requireAuth'

const ratingSchema = z.object({
  consultation_id: z.string().uuid(),
  stars:           z.number().int().min(1).max(5),
  comment:         z.string().max(300).optional(),
})

export function createRatingsRouter(db: PrismaClient): Router {
  const router = Router()

  router.post(
    '/',
    requireAuth,
    requireRole(Role.patient),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = ratingSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body' })
        return
      }
      const { consultation_id, stars, comment } = parsed.data

      try {
        const consultation = await db.consultation.findUnique({ where: { id: consultation_id } })
        if (!consultation) {
          res.status(404).json({ error: 'Consultation not found' })
          return
        }
        if (consultation.patient_id !== req.user!.sub) {
          res.status(403).json({ error: 'Not your consultation' })
          return
        }
        if (consultation.status !== ConsultationStatus.completed) {
          res.status(409).json({ error: 'Consultation not completed' })
          return
        }
        if (!consultation.doctor_id) {
          res.status(409).json({ error: 'Consultation has no doctor' })
          return
        }

        await db.rating.create({
          data: {
            id:              randomUUID(),
            consultation_id,
            doctor_id:       consultation.doctor_id,
            patient_id:      req.user!.sub,
            stars,
            comment,
          },
        })
        res.status(201).send()
      } catch (err: unknown) {
        if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002') {
          res.status(409).json({ error: 'Already rated' })
          return
        }
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  return router
}
