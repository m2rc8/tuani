import express from 'express'
import helmet from 'helmet'
import type { PrismaClient } from '@prisma/client'
import type { Server } from 'socket.io'
import { AuthService } from './services/AuthService'
import { ConsultationService } from './services/ConsultationService'
import { PrescriptionService } from './services/PrescriptionService'
import { UploadService } from './services/UploadService'
import { otpService } from './services/OtpService'
import { prisma as defaultPrisma } from './lib/prisma'
import { createAuthRouter } from './routes/auth'
import { createDoctorsRouter } from './routes/doctors'
import { createAdminRouter } from './routes/admin'
import { createConsultationsRouter } from './routes/consultations'

interface AppDeps {
  authService?:         AuthService
  consultationService?: ConsultationService
  prescriptionService?: PrescriptionService
  uploadService?:       UploadService
  db?:                  PrismaClient
  io?:                  Server
}

export function createApp(deps?: AppDeps): { app: express.Express } {
  const app = express()

  app.use(helmet())
  app.use(express.json({ limit: '10kb' }))

  const db                  = deps?.db                  ?? defaultPrisma
  const authService         = deps?.authService         ?? new AuthService(otpService, db)
  const consultationService = deps?.consultationService ?? new ConsultationService(db, deps?.io)
  const prescriptionService = deps?.prescriptionService ?? new PrescriptionService(db)
  const uploadService       = deps?.uploadService       ?? new UploadService()

  app.use('/api/auth',          createAuthRouter(authService))
  app.use('/api/doctors',       createDoctorsRouter(db))
  app.use('/api/admin',         createAdminRouter(db))
  app.use('/api/consultations', createConsultationsRouter(consultationService, uploadService))
  app.get('/health', (_req, res) => res.json({ ok: true }))

  return { app }
}
