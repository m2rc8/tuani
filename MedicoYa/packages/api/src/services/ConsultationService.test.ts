import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationService, ConsultationError, Medication } from './ConsultationService'
import { ConsultationStatus, PaymentStatus, Role, Language } from '@prisma/client'

const PATIENT_ID = 'patient-uuid-1'
const DOCTOR_ID  = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'
const SECRET     = 'test-secret-medicoya-min-32-chars-ok'

const baseConsultation = {
  id: CONSULT_ID,
  patient_id: PATIENT_ID,
  doctor_id: null,
  status: ConsultationStatus.pending,
  symptoms_text: 'headache',
  symptom_photo: null,
  diagnosis: null,
  diagnosis_code: null,
  price_lps: null,
  payment_status: PaymentStatus.pending,
  created_at: new Date(),
  completed_at: null,
}

const mockDb = {
  consultation: {
    create:     vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
    findMany:   vi.fn(),
  },
  prescription: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

describe('ConsultationService', () => {
  let svc: ConsultationService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new ConsultationService(mockDb as any)
  })

  describe('createConsultation', () => {
    it('creates consultation with patient_id and symptoms', async () => {
      mockDb.consultation.create.mockResolvedValue({ ...baseConsultation })
      const result = await svc.createConsultation(PATIENT_ID, { symptoms_text: 'headache' })
      expect(mockDb.consultation.create).toHaveBeenCalledWith({
        data: { patient_id: PATIENT_ID, symptoms_text: 'headache', symptom_photo: undefined },
      })
      expect(result.patient_id).toBe(PATIENT_ID)
    })

    it('creates consultation without photo when not provided', async () => {
      mockDb.consultation.create.mockResolvedValue({ ...baseConsultation })
      await svc.createConsultation(PATIENT_ID, {})
      expect(mockDb.consultation.create).toHaveBeenCalledWith({
        data: { patient_id: PATIENT_ID, symptoms_text: undefined, symptom_photo: undefined },
      })
    })
  })

  describe('getConsultation', () => {
    it('returns consultation when user is patient', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      const result = await svc.getConsultation(CONSULT_ID, PATIENT_ID)
      expect(result.id).toBe(CONSULT_ID)
    })

    it('returns consultation when user is doctor', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation, doctor_id: DOCTOR_ID })
      const result = await svc.getConsultation(CONSULT_ID, DOCTOR_ID)
      expect(result.id).toBe(CONSULT_ID)
    })

    it('throws NOT_FOUND when consultation does not exist', async () => {
      mockDb.consultation.findUnique.mockResolvedValue(null)
      await expect(svc.getConsultation(CONSULT_ID, PATIENT_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('throws NOT_PARTICIPANT when user is neither patient nor doctor', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      await expect(svc.getConsultation(CONSULT_ID, 'other-user')).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' })
    })
  })

  describe('acceptConsultation', () => {
    it('sets status to active and doctor_id', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      mockDb.consultation.update.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.active, doctor_id: DOCTOR_ID,
      })
      const result = await svc.acceptConsultation(CONSULT_ID, DOCTOR_ID)
      expect(result.status).toBe(ConsultationStatus.active)
      expect(mockDb.consultation.update).toHaveBeenCalledWith({
        where: { id: CONSULT_ID },
        data:  { status: ConsultationStatus.active, doctor_id: DOCTOR_ID },
      })
    })

    it('throws WRONG_STATUS when consultation is not pending', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.active,
      })
      await expect(svc.acceptConsultation(CONSULT_ID, DOCTOR_ID)).rejects.toMatchObject({ code: 'WRONG_STATUS' })
    })
  })

  describe('rejectConsultation', () => {
    it('sets status to rejected', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      mockDb.consultation.update.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.rejected,
      })
      const result = await svc.rejectConsultation(CONSULT_ID, DOCTOR_ID)
      expect(result.status).toBe(ConsultationStatus.rejected)
    })

    it('throws WRONG_STATUS when not pending', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.completed,
      })
      await expect(svc.rejectConsultation(CONSULT_ID, DOCTOR_ID)).rejects.toMatchObject({ code: 'WRONG_STATUS' })
    })
  })

  describe('cancelConsultation', () => {
    it('sets status to cancelled from pending', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      mockDb.consultation.update.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.cancelled,
      })
      const result = await svc.cancelConsultation(CONSULT_ID, PATIENT_ID)
      expect(result.status).toBe(ConsultationStatus.cancelled)
    })

    it('throws WRONG_STATUS when already completed', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.completed,
      })
      await expect(svc.cancelConsultation(CONSULT_ID, PATIENT_ID)).rejects.toMatchObject({ code: 'WRONG_STATUS' })
    })
  })

  describe('completeConsultation', () => {
    const meds: Medication[] = [{ name: 'Ibuprofen', dose: '400mg', frequency: 'every 8h' }]

    it('runs $transaction with consultation update + prescription create', async () => {
      const activeConsult = { ...baseConsultation, status: ConsultationStatus.active, doctor_id: DOCTOR_ID }
      mockDb.consultation.findUnique.mockResolvedValue(activeConsult)
      const completedConsult  = { ...activeConsult, status: ConsultationStatus.completed, diagnosis: 'flu' }
      const mockPrescription  = {
        id: 'presc-1', consultation_id: CONSULT_ID, qr_code: 'ABCD123456',
        medications: meds, instructions: null, valid_until: new Date(), created_at: new Date(),
      }
      mockDb.$transaction.mockResolvedValue([completedConsult, mockPrescription])

      const result = await svc.completeConsultation(CONSULT_ID, DOCTOR_ID, { diagnosis: 'flu', medications: meds })
      expect(mockDb.$transaction).toHaveBeenCalled()
      expect(result.consultation.status).toBe(ConsultationStatus.completed)
      expect(result.prescription.qr_code).toBeTruthy()
    })

    it('throws WRONG_STATUS when not active', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      await expect(
        svc.completeConsultation(CONSULT_ID, DOCTOR_ID, { diagnosis: 'flu', medications: meds })
      ).rejects.toMatchObject({ code: 'WRONG_STATUS' })
    })
  })

  describe('confirmPayment', () => {
    it('updates payment_status to confirmed', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({
        ...baseConsultation, doctor_id: DOCTOR_ID, status: ConsultationStatus.completed,
      })
      mockDb.consultation.update.mockResolvedValue({
        ...baseConsultation, payment_status: PaymentStatus.confirmed,
      })
      const result = await svc.confirmPayment(CONSULT_ID, DOCTOR_ID)
      expect(result.payment_status).toBe(PaymentStatus.confirmed)
    })
  })

  describe('getUserConsultations', () => {
    it('queries by patient_id when role is patient', async () => {
      mockDb.consultation.findMany.mockResolvedValue([{ ...baseConsultation }])
      await svc.getUserConsultations(PATIENT_ID, Role.patient)
      expect(mockDb.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patient_id: PATIENT_ID } })
      )
    })

    it('queries by doctor_id when role is doctor', async () => {
      mockDb.consultation.findMany.mockResolvedValue([])
      await svc.getUserConsultations(DOCTOR_ID, Role.doctor)
      expect(mockDb.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { doctor_id: DOCTOR_ID } })
      )
    })
  })
})
