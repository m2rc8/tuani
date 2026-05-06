import Expo, { ExpoPushMessage } from 'expo-server-sdk'
import { PrismaClient, ConsultationStatus } from '@prisma/client'

export interface LocalizedMessage {
  es: { title: string; body: string }
  en: { title: string; body: string }
}

export const NEW_CONSULTATION_MSG: LocalizedMessage = {
  es: { title: 'Nueva consulta',       body: 'Un paciente necesita atención.' },
  en: { title: 'New consultation',     body: 'A patient needs attention.' },
}
export const ACCEPTED_MSG: LocalizedMessage = {
  es: { title: 'Médico asignado',      body: 'Un médico aceptó tu consulta. Entra al chat.' },
  en: { title: 'Doctor assigned',      body: 'A doctor accepted your consultation. Join the chat.' },
}
export const COMPLETED_MSG: LocalizedMessage = {
  es: { title: 'Receta lista',         body: 'Tu consulta finalizó. Revisa tu receta.' },
  en: { title: 'Prescription ready',   body: 'Your consultation is complete. View your prescription.' },
}
export const NEW_MESSAGE_MSG: LocalizedMessage = {
  es: { title: 'Nuevo mensaje',        body: 'Tienes un mensaje en tu consulta.' },
  en: { title: 'New message',          body: 'You have a new message in your consultation.' },
}
const MISSED_QUEUE_MSG: LocalizedMessage = {
  es: { title: 'Consulta sin atender', body: 'Hay pacientes esperando respuesta.' },
  en: { title: 'Unanswered consultation', body: 'Patients are waiting for a response.' },
}

export class NotificationService {
  private expo = new Expo()

  constructor(private db: PrismaClient) {}

  async sendToUser(userId: string, msg: LocalizedMessage): Promise<void> {
    await this.sendToUsers([userId], msg)
  }

  async sendToUsers(userIds: string[], msg: LocalizedMessage): Promise<void> {
    if (userIds.length === 0) return
    const tokens = await this.db.pushToken.findMany({
      where:   { user_id: { in: userIds } },
      include: { user: { select: { preferred_language: true } } },
    })
    if (tokens.length === 0) return

    const validTokens = tokens.filter(t => Expo.isExpoPushToken(t.token))
    if (validTokens.length === 0) return

    const messages: ExpoPushMessage[] = validTokens.map(t => {
      const lang = t.user.preferred_language === 'en' ? 'en' : 'es'
      return { to: t.token, title: msg[lang].title, body: msg[lang].body, sound: 'default' as const }
    })

    const tickets = await this.expo.sendPushNotificationsAsync(messages)

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i]
      if (
        ticket.status === 'error' &&
        (ticket as { status: 'error'; details?: { error?: string } }).details?.error === 'DeviceNotRegistered'
      ) {
        await this.db.pushToken.delete({ where: { id: validTokens[i].id } }).catch((err) => {
          console.error('Failed to delete stale push token:', err)
        })
      }
    }
  }

  async sendMissedQueueReminder(): Promise<void> {
    const now         = Date.now()
    const twoMinAgo   = new Date(now - 2 * 60 * 1000)
    const threeMinAgo = new Date(now - 3 * 60 * 1000)

    const pending = await this.db.consultation.findMany({
      where:  { status: ConsultationStatus.pending, created_at: { gte: threeMinAgo, lt: twoMinAgo } },
      select: { id: true },
    })
    if (pending.length === 0) return

    const doctors = await this.db.doctor.findMany({
      where:  { available: true, approved_at: { not: null } },
      select: { id: true },
    })
    await this.sendToUsers(doctors.map(d => d.id), MISSED_QUEUE_MSG)
  }
}
