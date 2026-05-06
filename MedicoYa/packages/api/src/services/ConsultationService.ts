import crypto from 'crypto'
import { PrismaClient, Consultation, Prescription, ConsultationStatus, PaymentStatus, Role, Prisma } from '@prisma/client'
import type { Server } from 'socket.io'
import { NotificationService, NEW_CONSULTATION_MSG, ACCEPTED_MSG, COMPLETED_MSG } from './NotificationService'

export interface Medication {
  name: string
  dose: string
  frequency: string
  code?: string
}

interface CompleteData {
  diagnosis: string
  diagnosis_code?: string
  medications: Medication[]
  instructions?: string
  price_lps?: number
}

export class ConsultationError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'NOT_PARTICIPANT' | 'WRONG_STATUS' | 'WRONG_ROLE',
    message: string
  ) {
    super(message)
    this.name = 'ConsultationError'
  }
}

export class ConsultationService {
  constructor(
    private readonly db: PrismaClient,
    private io?: Server,
    private notificationService?: NotificationService
  ) {}

  async createConsultation(
    patientId: string,
    data: { symptoms_text?: string; symptom_photo?: string }
  ): Promise<Consultation> {
    const consultation = await this.db.consultation.create({
      data: { patient_id: patientId, symptoms_text: data.symptoms_text, symptom_photo: data.symptom_photo },
    })
    if (this.io) {
      const patient = await this.db.patient.findUnique({
        where: { id: patientId },
        include: { user: { select: { phone: true } } },
      })
      this.io.to('doctors').emit('new_consultation', {
        id: consultation.id,
        symptoms_text: consultation.symptoms_text,
        created_at: consultation.created_at,
        patient: { user: { phone: patient?.user.phone ?? '' } },
      })
    }
    if (this.notificationService) {
      const doctors = await this.db.doctor.findMany({
        where:  { available: true, approved_at: { not: null } },
        select: { id: true },
      })
      this.notificationService.sendToUsers(doctors.map(d => d.id), NEW_CONSULTATION_MSG).catch((err) => {
        console.error('Failed to send new consultation notification:', err)
      })
    }
    return consultation
  }

  async getConsultation(id: string, userId: string) {
    const c = await this.db.consultation.findUnique({
      where:   { id },
      include: { prescription: true, rating: true },
    })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.patient_id !== userId && c.doctor_id !== userId)
      throw new ConsultationError('NOT_PARTICIPANT', 'Not a participant of this consultation')
    return c
  }

  async acceptConsultation(id: string, doctorId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.status !== ConsultationStatus.pending)
      throw new ConsultationError('WRONG_STATUS', 'Consultation must be pending to accept')
    const updated = await this.db.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.active, doctor_id: doctorId },
    })
    this.io?.to(id).emit('consultation_updated', { id, status: ConsultationStatus.active })
    this.notificationService?.sendToUser(c.patient_id, ACCEPTED_MSG).catch((err) => {
      console.error('Failed to send accepted notification:', err)
    })
    return updated
  }

  async rejectConsultation(id: string, doctorId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.status !== ConsultationStatus.pending)
      throw new ConsultationError('WRONG_STATUS', 'Consultation must be pending to reject')
    const updated = await this.db.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.rejected },
    })
    this.io?.to(id).emit('consultation_updated', { id, status: ConsultationStatus.rejected })
    return updated
  }

  async cancelConsultation(id: string, userId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    const terminal: ConsultationStatus[] = [
      ConsultationStatus.completed, ConsultationStatus.rejected, ConsultationStatus.cancelled,
    ]
    if (terminal.includes(c.status))
      throw new ConsultationError('WRONG_STATUS', 'Consultation cannot be cancelled in current status')
    const updated = await this.db.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.cancelled },
    })
    this.io?.to(id).emit('consultation_updated', { id, status: ConsultationStatus.cancelled })
    return updated
  }

  async completeConsultation(
    id: string,
    doctorId: string,
    data: CompleteData
  ): Promise<{ consultation: Consultation; prescription: Prescription }> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.status !== ConsultationStatus.active)
      throw new ConsultationError('WRONG_STATUS', 'Consultation must be active to complete')

    const qr_code = crypto.randomBytes(7).toString('base64url').slice(0, 10)
    const valid_until = new Date()
    valid_until.setDate(valid_until.getDate() + 30)

    const [consultation, prescription] = await this.db.$transaction([
      this.db.consultation.update({
        where: { id },
        data: {
          status: ConsultationStatus.completed,
          diagnosis: data.diagnosis,
          diagnosis_code: data.diagnosis_code,
          price_lps: data.price_lps,
          completed_at: new Date(),
        },
      }),
      this.db.prescription.create({
        data: {
          consultation_id: id,
          qr_code,
          medications: data.medications as unknown as Prisma.InputJsonValue,
          instructions: data.instructions,
          valid_until,
        },
      }),
    ])

    this.io?.to(id).emit('consultation_updated', { id, status: ConsultationStatus.completed })
    this.notificationService?.sendToUser(c.patient_id, COMPLETED_MSG).catch((err) => {
      console.error('Failed to send completed notification:', err)
    })
    return { consultation, prescription }
  }

  async confirmPayment(id: string, doctorId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.doctor_id !== doctorId)
      throw new ConsultationError('WRONG_ROLE', 'Only the assigned doctor can confirm payment')
    return this.db.consultation.update({
      where: { id },
      data: { payment_status: PaymentStatus.confirmed },
    })
  }

  async getUserConsultations(userId: string, role: Role): Promise<Consultation[]> {
    const where = role === Role.patient ? { patient_id: userId } : { doctor_id: userId }
    return this.db.consultation.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 20,
    })
  }

  async getPendingQueue() {
    return this.db.consultation.findMany({
      where: { status: ConsultationStatus.pending },
      include: { patient: { include: { user: { select: { phone: true } } } } },
      orderBy: { created_at: 'asc' },
    })
  }
}
