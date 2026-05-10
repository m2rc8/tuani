import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { DentalService } from '../services/DentalService'

const createRecordSchema = z.object({
  patient_id:    z.string().uuid(),
  brigade_id:    z.string().uuid().optional(),
  hygiene_notes: z.string().max(500).optional(),
})

const updateTeethSchema = z.object({
  teeth: z.array(z.object({
    tooth_fdi:          z.number().int(),
    surface_mesial:     z.enum(['healthy','caries','filled','missing','crown','indicated_extraction']).optional(),
    surface_distal:     z.enum(['healthy','caries','filled','missing','crown','indicated_extraction']).optional(),
    surface_occlusal:   z.enum(['healthy','caries','filled','missing','crown','indicated_extraction']).optional(),
    surface_vestibular: z.enum(['healthy','caries','filled','missing','crown','indicated_extraction']).optional(),
    surface_palatal:    z.enum(['healthy','caries','filled','missing','crown','indicated_extraction']).optional(),
    notes:              z.string().max(500).optional(),
  })),
})

const addTreatmentSchema = z.object({
  tooth_fdi: z.number().int().optional(),
  procedure: z.string().min(1).max(100),
  status:    z.enum(['pending','in_progress','completed']).optional(),
  priority:  z.enum(['urgent','elective']).optional(),
  cost_lps:  z.number().positive().optional(),
  notes:     z.string().max(500).optional(),
})

export function createDentalRouter(db: PrismaClient): Router {
  const router  = Router()
  const service = new DentalService(db)

  // Create dental record
  router.post(
    '/records',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = createRecordSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const record = await service.createRecord(req.user!.sub, parsed.data)
        res.status(201).json(record)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // Get patient dental history
  router.get(
    '/records/patient/:patientId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const records = await service.getPatientRecords(req.params.patientId)
        res.json(records)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // Get single record
  router.get(
    '/records/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const record = await service.getRecord(req.params.id)
        if (!record) { res.status(404).json({ error: 'Record not found' }); return }
        res.json(record)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // Update teeth
  router.put(
    '/records/:id/teeth',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = updateTeethSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const record = await service.updateTeeth(req.params.id, parsed.data)
        res.json(record)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // Add treatment
  router.post(
    '/records/:id/treatments',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = addTreatmentSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const treatment = await service.addTreatment(req.params.id, parsed.data)
        res.status(201).json(treatment)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // Brigade dental report
  router.get(
    '/brigades/:brigadeId/report',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const report = await service.getBrigadeDentalReport(req.params.brigadeId)
        res.json(report)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  return router
}
