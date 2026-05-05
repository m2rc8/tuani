import { Router, Request, Response } from 'express'
import { PrescriptionService, PrescriptionError } from '../services/PrescriptionService'
import { requireAuth } from '../middleware/requireAuth'

function handlePrescriptionError(err: unknown, res: Response): boolean {
  if (err instanceof PrescriptionError) {
    res.status(err.code === 'NOT_FOUND' ? 404 : 403).json({ error: err.message })
    return true
  }
  return false
}

export function createPrescriptionsRouter(prescriptionService: PrescriptionService): Router {
  const router = Router()

  router.get(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const prescription = await prescriptionService.getPrescription(req.params.id, req.user!.sub)
        res.json(prescription)
      } catch (err) {
        if (!handlePrescriptionError(err, res)) throw err
      }
    }
  )

  router.get(
    '/:id/qr',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const buffer = await prescriptionService.getQrPng(req.params.id, req.user!.sub)
        res.setHeader('Content-Type', 'image/png')
        res.send(buffer)
      } catch (err) {
        if (!handlePrescriptionError(err, res)) throw err
      }
    }
  )

  return router
}
