import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/requireAuth'
import { toFhirEncounter, toFhirPatient, toFhirPractitioner, toFhirMedicationBundle } from '../lib/fhir'

const FHIR_JSON = 'application/fhir+json'

export function createFhirRouter(db: PrismaClient): Router {
  const router = Router()

  router.get('/Encounter/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const c = await db.consultation.findUnique({ where: { id: req.params.id } })
    if (!c) { res.status(404).json({ error: 'Not found' }); return }
    if (c.patient_id !== req.user!.sub && c.doctor_id !== req.user!.sub) {
      res.status(403).json({ error: 'Not a participant' }); return
    }
    res.setHeader('Content-Type', FHIR_JSON).json(toFhirEncounter(c))
  })

  router.get('/Patient/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const targetId = req.params.id
    const callerId = req.user!.sub

    if (callerId !== targetId) {
      const shared = await db.consultation.findFirst({
        where:  { patient_id: targetId, doctor_id: callerId },
        select: { id: true },
      })
      if (!shared) {
        res.status(403).json({ error: 'Forbidden' }); return
      }
    }

    const user = await db.user.findUnique({
      where:   { id: targetId },
      include: { patient: true },
    })
    if (!user?.patient) { res.status(404).json({ error: 'Not found' }); return }
    res.setHeader('Content-Type', FHIR_JSON).json(toFhirPatient(user, user.patient))
  })

  router.get('/Practitioner/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const doctor = await db.doctor.findUnique({
      where:   { id: req.params.id },
      include: { user: true },
    })
    if (!doctor) { res.status(404).json({ error: 'Not found' }); return }
    res.setHeader('Content-Type', FHIR_JSON).json(toFhirPractitioner(doctor.user, doctor))
  })

  router.get('/MedicationRequest/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const p = await db.prescription.findUnique({
      where:   { id: req.params.id },
      include: { consultation: { select: { patient_id: true, doctor_id: true } } },
    })
    if (!p) { res.status(404).json({ error: 'Not found' }); return }
    const { patient_id, doctor_id } = (p as any).consultation
    if (patient_id !== req.user!.sub && doctor_id !== req.user!.sub) {
      res.status(403).json({ error: 'Not a participant' }); return
    }
    res.setHeader('Content-Type', FHIR_JSON).json(toFhirMedicationBundle(p, patient_id))
  })

  return router
}
