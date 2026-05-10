import 'dotenv/config'
import * as Sentry from '@sentry/node'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  tracesSampleRate: 0.2,
})

import { createServer } from 'http'
import { Server } from 'socket.io'
import cron from 'node-cron'
import { createApp } from './app'
import { registerConsultationHandlers } from './sockets/consultation'
import { NotificationService } from './services/NotificationService'
import { prisma } from './lib/prisma'

const httpServer          = createServer()
const io                  = new Server(httpServer, { cors: { origin: '*' } })
const notificationService = new NotificationService(prisma)
const { app }             = createApp({ io, notificationService })

httpServer.on('request', app)
registerConsultationHandlers(io, prisma, notificationService)

cron.schedule('* * * * *', () => {
  notificationService.sendMissedQueueReminder().catch((err) => {
    console.error('Missed queue reminder error:', err)
  })
})

const PORT = parseInt(process.env.PORT ?? '3000', 10)
httpServer.listen(PORT, () => console.log(`MédicoYa API on port ${PORT}`))
