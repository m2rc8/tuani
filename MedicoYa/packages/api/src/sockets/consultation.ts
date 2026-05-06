import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import type { Server, Socket } from 'socket.io'
import type { JwtPayload } from '../middleware/requireAuth'
import { NotificationService, NEW_MESSAGE_MSG } from '../services/NotificationService'

export function registerConsultationHandlers(
  io: Server,
  db: PrismaClient,
  notificationService?: NotificationService
): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('UNAUTHORIZED'))
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
      socket.data.user = { sub: payload.sub, role: payload.role, preferred_language: payload.preferred_language }
      next()
    } catch {
      next(new Error('UNAUTHORIZED'))
    }
  })

  io.on('connection', (socket: Socket) => {
    if (socket.data.user?.role === 'doctor') {
      socket.join('doctors')
    }

    socket.on('join_consultation', async ({ consultation_id }: { consultation_id: string }) => {
      try {
        const c = await db.consultation.findUnique({ where: { id: consultation_id } })
        if (!c) {
          socket.emit('error', { code: 'NOT_FOUND', message: 'Consultation not found' })
          return
        }
        const userId = socket.data.user.sub
        if (c.patient_id !== userId && c.doctor_id !== userId) {
          socket.emit('error', { code: 'NOT_PARTICIPANT', message: 'Not a participant' })
          return
        }
        socket.join(consultation_id)
      } catch {
        socket.emit('error', { code: 'SERVER_ERROR', message: 'Unexpected error' })
      }
    })

    socket.on(
      'send_message',
      async ({
        consultation_id,
        content,
        msg_type,
      }: {
        consultation_id: string
        content: string
        msg_type: 'text' | 'image'
      }) => {
        try {
          const c = await db.consultation.findUnique({ where: { id: consultation_id } })
          if (!c) { socket.emit('error', { code: 'NOT_FOUND', message: 'Consultation not found' }); return }
          const userId = socket.data.user.sub
          if (c.patient_id !== userId && c.doctor_id !== userId) {
            socket.emit('error', { code: 'NOT_PARTICIPANT', message: 'Not a participant' }); return
          }
          const message = await db.message.create({
            data: {
              consultation_id,
              sender_id: userId,
              content,
              msg_type: msg_type ?? 'text',
            },
          })
          io.to(consultation_id).emit('receive_message', {
            id:         message.id,
            sender_id:  message.sender_id,
            content:    message.content,
            msg_type:   message.msg_type,
            created_at: message.created_at,
          })
          const recipientId = userId === c.patient_id ? c.doctor_id : c.patient_id
          if (recipientId) {
            notificationService?.sendToUser(recipientId, NEW_MESSAGE_MSG).catch(() => {})
          }
        } catch {
          socket.emit('error', { code: 'SERVER_ERROR', message: 'Unexpected error' })
        }
      }
    )
  })
}
