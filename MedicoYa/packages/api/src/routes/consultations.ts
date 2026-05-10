import { Router, Request, Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { RtcTokenBuilder, RtcRole } from 'agora-access-token'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { ConsultationService, ConsultationError } from '../services/ConsultationService'
import { UploadService } from '../services/UploadService'
import { prisma } from '../lib/prisma'

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
  },
})

const completeSchema = z.object({
  diagnosis:      z.string().min(1),
  diagnosis_code: z.string().optional(),
  medications:    z.array(z.object({
    name:      z.string(),
    dose:      z.string(),
    frequency: z.string(),
    code:      z.string().optional(),
  })),
  instructions: z.string().optional(),
  price_lps:    z.number().optional(),
})

function handleConsultationError(err: unknown, res: Response): boolean {
  if (err instanceof ConsultationError) {
    const map: Record<string, number> = {
      NOT_FOUND: 404, NOT_PARTICIPANT: 403, WRONG_STATUS: 409, WRONG_ROLE: 403,
    }
    res.status(map[err.code] ?? 500).json({ error: err.message })
    return true
  }
  return false
}

export function createConsultationsRouter(
  consultationService: ConsultationService,
  uploadService: UploadService
): Router {
  const router = Router()

  router.post(
    '/',
    requireAuth,
    requireRole(Role.patient),
    upload.single('photo'),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const symptom_photo = req.file
          ? await uploadService.uploadPhoto(req.file.buffer, req.file.mimetype)
          : undefined

        const consultation = await consultationService.createConsultation(req.user!.sub, {
          symptoms_text: req.body.symptoms_text,
          symptom_photo,
        })
        res.status(201).json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  // /my MUST be registered before /:id to avoid Express matching "my" as an id param
  router.get(
    '/my',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const consultations = await consultationService.getUserConsultations(
        req.user!.sub,
        req.user!.role
      )
      res.json(consultations)
    }
  )

  // /queue must be before /:id — Express would match literal "queue" as an id param otherwise
  router.get(
    '/queue',
    requireAuth,
    requireRole(Role.doctor),
    async (_req: Request, res: Response): Promise<void> => {
      const consultations = await consultationService.getPendingQueue()
      res.json(consultations)
    }
  )

  router.get(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.getConsultation(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/accept',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.acceptConsultation(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/reject',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.rejectConsultation(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/cancel',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.cancelConsultation(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/complete',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = completeSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'diagnosis and medications are required' })
        return
      }
      try {
        const result = await consultationService.completeConsultation(
          req.params.id,
          req.user!.sub,
          parsed.data
        )
        res.json(result)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/payment',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.confirmPayment(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.post(
    '/:id/video-token',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const consultationId = req.params.id

      const consultation = await prisma.consultation.findUnique({
        where:  { id: consultationId },
        select: { patient_id: true, doctor_id: true, status: true },
      })

      if (!consultation) {
        res.status(404).json({ error: 'Consultation not found' })
        return
      }

      if (consultation.status === 'completed') {
        res.status(403).json({ error: 'Consultation already completed' })
        return
      }

      const userId = req.user!.sub
      if (userId !== consultation.patient_id && userId !== consultation.doctor_id) {
        res.status(403).json({ error: 'Not a participant of this consultation' })
        return
      }

      const appId          = process.env.AGORA_APP_ID          ?? ''
      const appCertificate = process.env.AGORA_APP_CERTIFICATE ?? ''

      if (!appId || !appCertificate) {
        res.status(503).json({ error: 'Video calls not configured' })
        return
      }

      const uid        = 0
      const expireTime = Math.floor(Date.now() / 1000) + 3600

      const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        consultationId,
        uid,
        RtcRole.PUBLISHER,
        expireTime,
      )

      res.json({ token, channel: consultationId, uid: 0, appId })
    }
  )

  return router
}
