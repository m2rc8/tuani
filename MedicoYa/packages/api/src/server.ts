import 'dotenv/config'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createApp } from './app'

const httpServer = createServer()
const io         = new Server(httpServer, { cors: { origin: '*' } })
const { app }    = createApp({ io })
httpServer.on('request', app)

const PORT = parseInt(process.env.PORT ?? '3000', 10)
httpServer.listen(PORT, () => console.log(`MédicoYa API on port ${PORT}`))
