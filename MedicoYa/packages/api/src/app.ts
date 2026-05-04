import express from 'express'
import helmet from 'helmet'
import { AuthService } from './services/AuthService'
import { otpService } from './services/OtpService'
import { prisma } from './lib/prisma'
import { createAuthRouter } from './routes/auth'

interface AppDeps {
  authService?: AuthService
}

export function createApp(deps?: AppDeps): express.Express {
  const app = express()

  app.use(helmet())
  app.use(express.json())

  const authService =
    deps?.authService ?? new AuthService(otpService, prisma)

  app.use('/api/auth', createAuthRouter(authService))
  app.get('/health', (_req, res) => res.json({ ok: true }))

  return app
}
