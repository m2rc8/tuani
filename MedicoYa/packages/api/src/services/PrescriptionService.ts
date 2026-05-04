import QRCode from 'qrcode'
import { PrismaClient, Prescription } from '@prisma/client'

export class PrescriptionError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'NOT_PARTICIPANT', message: string) {
    super(message)
    this.name = 'PrescriptionError'
  }
}

export class PrescriptionService {
  constructor(private readonly db: PrismaClient) {}

  async getPrescription(id: string, userId: string): Promise<Prescription> {
    const p = await this.db.prescription.findUnique({
      where: { id },
      include: { consultation: { select: { patient_id: true, doctor_id: true } } },
    })
    if (!p) throw new PrescriptionError('NOT_FOUND', 'NOT_FOUND')
    const { patient_id, doctor_id } = (p as any).consultation
    if (patient_id !== userId && doctor_id !== userId)
      throw new PrescriptionError('NOT_PARTICIPANT', 'NOT_PARTICIPANT')
    return p
  }

  async getQrPng(id: string, userId: string): Promise<Buffer> {
    const p = await this.getPrescription(id, userId)
    return QRCode.toBuffer(`MEDICOYA:${p.qr_code}`)
  }
}
