import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrescriptionService } from './PrescriptionService'

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
  },
}))

const PATIENT_ID = 'patient-uuid-1'
const DOCTOR_ID  = 'doctor-uuid-1'
const PRESC_ID   = 'presc-uuid-1'
const CONSULT_ID = 'consult-uuid-1'

const mockPrescription = {
  id: PRESC_ID,
  consultation_id: CONSULT_ID,
  qr_code: 'ABC123XYZ0',
  medications: [{ name: 'Paracetamol', dose: '500mg', frequency: 'every 6h' }],
  instructions: 'Take with food',
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  created_at: new Date(),
  consultation: {
    patient_id: PATIENT_ID,
    doctor_id: DOCTOR_ID,
  },
}

const mockDb = {
  prescription: {
    findUnique: vi.fn(),
  },
}

describe('PrescriptionService', () => {
  let svc: PrescriptionService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new PrescriptionService(mockDb as any)
  })

  describe('getPrescription', () => {
    it('returns prescription for patient', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      const result = await svc.getPrescription(PRESC_ID, PATIENT_ID)
      expect(result.id).toBe(PRESC_ID)
    })

    it('returns prescription for doctor', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      const result = await svc.getPrescription(PRESC_ID, DOCTOR_ID)
      expect(result.id).toBe(PRESC_ID)
    })

    it('throws 404 when not found', async () => {
      mockDb.prescription.findUnique.mockResolvedValue(null)
      await expect(svc.getPrescription(PRESC_ID, PATIENT_ID)).rejects.toThrow('NOT_FOUND')
    })

    it('throws 403 when user is not participant', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      await expect(svc.getPrescription(PRESC_ID, 'other-user')).rejects.toThrow('NOT_PARTICIPANT')
    })
  })

  describe('getQrPng', () => {
    it('returns PNG buffer for valid prescription', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      const buffer = await svc.getQrPng(PRESC_ID, PATIENT_ID)
      expect(Buffer.isBuffer(buffer)).toBe(true)
    })

    it('calls qrcode.toBuffer with MEDICOYA: prefix', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      const QRCode = (await import('qrcode')).default
      await svc.getQrPng(PRESC_ID, PATIENT_ID)
      expect(QRCode.toBuffer).toHaveBeenCalledWith(`MEDICOYA:${mockPrescription.qr_code}`)
    })
  })
})
