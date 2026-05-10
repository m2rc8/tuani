import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import multer from 'multer'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { DentalService } from '../services/DentalService'
import { uploadStream } from '../lib/cloudinary'

const createMinorPatientSchema = z.object({
  first_name:    z.string().min(1).max(60),
  last_name:     z.string().min(1).max(60),
  dob:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guardian_name: z.string().max(100).optional(),
})

const upsertTeethSchema = z.object({
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
  tooth_fdi:  z.number().int().optional(),
  procedure:  z.string().min(1).max(100),
  status:     z.enum(['pending','in_progress','completed']).optional(),
  priority:   z.enum(['urgent','elective']).optional(),
  cost_lps:   z.number().positive().optional(),
  notes:      z.string().max(500).optional(),
  materials:  z.array(z.string().max(100)).optional(),
  started_at: z.string().datetime().optional(),
  ended_at:   z.string().datetime().optional(),
})

const updateVisitSchema = z.object({
  hygiene_notes:  z.string().max(1000).nullable().optional(),
  cpod_index:     z.number().min(0).max(32).nullable().optional(),
  treatment_plan: z.string().max(3000).nullable().optional(),
  referral_to:    z.string().max(200).nullable().optional(),
})

const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
  },
})

export function createDentalRouter(db: PrismaClient): Router {
  const router  = Router()
  const service = new DentalService(db)

  // ── Minor patients ──────────────────────────────────────────────────────────

  router.get(
    '/patients/minor/search',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const q = String(req.query.q ?? '').trim()
      if (!q) { res.json([]); return }
      try {
        const results = await service.searchMinorPatients(q)
        res.json(results.filter(r => r.patient).map(r => ({
          patient_id: r.patient!.id,
          name:       r.name,
        })))
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  router.post(
    '/patients/minor',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = createMinorPatientSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      const { first_name, last_name, dob, guardian_name } = parsed.data
      const fullName = `${first_name} ${last_name}`
      const placeholderPhone = `DENTAL-${randomUUID()}`
      try {
        const user = await db.user.create({
          data: {
            phone:      placeholderPhone,
            name:       fullName,
            role:       'patient',
            patient:    {
              create: {
                dob:       new Date(dob),
                allergies: guardian_name ? `Tutor: ${guardian_name}` : null,
              },
            },
          },
          select: { patient: { select: { id: true } } },
        })
        res.status(201).json({ patient_id: user.patient!.id })
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // ── Files ───────────────────────────────────────────────────────────────────

  router.post(
    '/files',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = z.object({ patient_id: z.string().uuid() }).safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const file = await service.createFile(parsed.data.patient_id)
        res.status(201).json(file)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  router.get(
    '/files/by-patient/:patientId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const file = await service.getFileByPatient(req.params.patientId)
        if (!file) { res.status(404).json({ error: 'File not found' }); return }
        res.json(file)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  router.get(
    '/files/:fileId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const file = await service.getFile(req.params.fileId)
        if (!file) { res.status(404).json({ error: 'File not found' }); return }
        res.json(file)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // ── Teeth (batch upsert) ────────────────────────────────────────────────────

  router.put(
    '/files/:fileId/teeth',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = upsertTeethSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const file = await service.upsertTeeth(req.params.fileId, parsed.data.teeth)
        res.json(file)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // ── Visits ──────────────────────────────────────────────────────────────────

  router.post(
    '/files/:fileId/visits',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = z.object({ brigade_id: z.string().uuid().optional() }).safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const visit = await service.createVisit(req.params.fileId, req.user!.sub, parsed.data.brigade_id)
        res.status(201).json(visit)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  router.get(
    '/visits/:visitId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const visit = await service.getVisit(req.params.visitId)
        if (!visit) { res.status(404).json({ error: 'Visit not found' }); return }
        res.json(visit)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  router.patch(
    '/visits/:visitId',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = updateVisitSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const visit = await service.updateVisit(req.params.visitId, parsed.data)
        res.json(visit)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // ── Dentist visit list (for HistoryScreen tab) ──────────────────────────────

  router.get(
    '/dentist/mine/visits',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const visits = await service.getDentistVisits(req.user!.sub)
        res.json(visits)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // ── Treatments ──────────────────────────────────────────────────────────────

  router.post(
    '/visits/:visitId/treatments',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const parsed = addTreatmentSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request' }); return }
      try {
        const treatment = await service.addTreatment(req.params.visitId, parsed.data)
        res.status(201).json(treatment)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  router.post(
    '/visits/:visitId/treatments/:treatmentId/images',
    requireAuth,
    upload.single('image'),
    async (req: Request, res: Response): Promise<void> => {
      const type = req.body?.type as string
      if (!req.file) { res.status(400).json({ error: 'No image provided' }); return }
      if (type !== 'before' && type !== 'after') { res.status(400).json({ error: 'type must be before or after' }); return }
      try {
        const url       = await uploadStream(req.file.buffer, 'medicoya/dental')
        const treatment = await service.updateTreatmentImage(req.params.treatmentId, type, url)
        res.json(treatment)
      } catch { res.status(500).json({ error: 'Internal server error' }) }
    }
  )

  // ── Brigade report ──────────────────────────────────────────────────────────

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
