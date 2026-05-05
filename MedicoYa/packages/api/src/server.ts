import 'dotenv/config'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createApp } from './app'
import { registerConsultationHandlers } from './sockets/consultation'
import { prisma } from './lib/prisma'

const httpServer = createServer()
const io         = new Server(httpServer, { cors: { origin: '*' } })
const { app }    = createApp({ io })
httpServer.on('request', app)
registerConsultationHandlers(io, prisma)

const PORT = parseInt(process.env.PORT ?? '3000', 10)
httpServer.listen(PORT, () => console.log(`MédicoYa API on port ${PORT}`))
