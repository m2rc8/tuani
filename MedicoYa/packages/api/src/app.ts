import express from 'express'
import helmet from 'helmet'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import type { Server } from 'socket.io'
import { AuthService } from './services/AuthService'
import { ConsultationService } from './services/ConsultationService'
import { PrescriptionService } from './services/PrescriptionService'
import { UploadService } from './services/UploadService'
import { NotificationService } from './services/NotificationService'
import { otpService } from './services/OtpService'
import { prisma as defaultPrisma } from './lib/prisma'
import { createAuthRouter } from './routes/auth'
import { createDoctorsRouter } from './routes/doctors'
import { createAdminRouter } from './routes/admin'
import { createConsultationsRouter } from './routes/consultations'
import { createPrescriptionsRouter } from './routes/prescriptions'
import { createNotificationsRouter } from './routes/notifications'
import { createFhirRouter }         from './routes/fhir'

interface AppDeps {
  authService?:         AuthService
  consultationService?: ConsultationService
  prescriptionService?: PrescriptionService
  uploadService?:       UploadService
  notificationService?: NotificationService
  db?:                  PrismaClient
  io?:                  Server
}

export function createApp(deps?: AppDeps): { app: express.Express } {
  const app = express()

  app.use('/admin', express.static(path.join(__dirname, '../../../apps/admin/out')))
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../../apps/admin/out/index.html'))
  })

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
  app.use('/api/prescriptions', createPrescriptionsRouter(prescriptionService))
  app.use('/api/notifications', createNotificationsRouter(db))
  app.use('/fhir/R4',           createFhirRouter(db))
  app.get('/health', (_req, res) => res.json({ ok: true }))

  return { app }
}
