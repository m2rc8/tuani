import { Router, Request, Response } from 'express'
import { Role } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { PatientService, PatientError, updateProfileSchema } from '../services/PatientService'

function handlePatientError(err: unknown, res: Response): boolean {
  if (err instanceof PatientError) {
    res.status(404).json({ error: err.message })
    return true
  }
  return false
}

export function createPatientsRouter(service: PatientService): Router {
  const router = Router()

  router.get(
    '/me',
    requireAuth,
    requireRole(Role.patient),
    async (req: Request, res: Response): Promise<void> => {
      try {
        res.json(await service.getProfile(req.user!.sub))
      } catch (err) {
        if (!handlePatientError(err, res)) throw err
      }
    }
  )

  router.put(
    '/me',
    requireAuth,
    requireRole(Role.patient),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = updateProfileSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid profile data' })
        return
      }
      try {
        res.json(await service.updateProfile(req.user!.sub, parsed.data))
      } catch (err) {
        if (!handlePatientError(err, res)) throw err
      }
    }
  )

  return router
}
