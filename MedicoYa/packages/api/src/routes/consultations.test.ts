import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language, ConsultationStatus, PaymentStatus } from '@prisma/client'
import { ConsultationError } from '../services/ConsultationService'

const SECRET    = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID    = 'patient-uuid-1'
const DOC_ID    = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const baseConsultation = {
  id: CONSULT_ID, patient_id: PAT_ID, doctor_id: null,
  status: ConsultationStatus.pending,
  symptoms_text: 'headache', symptom_photo: null,
  diagnosis: null, diagnosis_code: null,
  price_lps: null, payment_status: PaymentStatus.pending,
  created_at: new Date(), completed_at: null,
}

const mockConsultationService = {
  createConsultation:  vi.fn(),
  getConsultation:     vi.fn(),
  acceptConsultation:  vi.fn(),
  rejectConsultation:  vi.fn(),
  cancelConsultation:  vi.fn(),
  completeConsultation: vi.fn(),
  confirmPayment:      vi.fn(),
  getUserConsultations: vi.fn(),
}

const mockUploadService = {
  uploadPhoto: vi.fn().mockResolvedValue('https://res.cloudinary.com/test/image/upload/test.jpg'),
}

function makeTestApp() {
  const { app } = createApp({
    consultationService: mockConsultationService as any,
    uploadService:       mockUploadService as any,
  })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/consultations', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).post('/api/consultations').send({})
    expect(res.status).toBe(401)
  })

  it('returns 403 when caller is a doctor', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ symptoms_text: 'headache' })
    expect(res.status).toBe(403)
  })

  it('creates consultation without photo', async () => {
    mockConsultationService.createConsultation.mockResolvedValue({ ...baseConsultation })
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .field('symptoms_text', 'headache')
    expect(res.status).toBe(201)
    expect(res.body.patient_id).toBe(PAT_ID)
    expect(mockUploadService.uploadPhoto).not.toHaveBeenCalled()
  })

  it('uploads photo and passes URL to service', async () => {
    mockConsultationService.createConsultation.mockResolvedValue({
      ...baseConsultation, symptom_photo: 'https://res.cloudinary.com/test/image/upload/test.jpg',
    })
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .field('symptoms_text', 'rash')
      .attach('photo', Buffer.from('fake-image-data'), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(201)
    expect(mockUploadService.uploadPhoto).toHaveBeenCalled()
    expect(mockConsultationService.createConsultation).toHaveBeenCalledWith(
      PAT_ID,
      expect.objectContaining({ symptom_photo: 'https://res.cloudinary.com/test/image/upload/test.jpg' })
    )
  })
})

describe('GET /api/consultations/my', () => {
  it('returns consultations for current user', async () => {
    mockConsultationService.getUserConsultations.mockResolvedValue([{ ...baseConsultation }])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/consultations/my')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(mockConsultationService.getUserConsultations).toHaveBeenCalledWith(PAT_ID, Role.patient)
  })
})

describe('GET /api/consultations/:id', () => {
  it('returns consultation for participant', async () => {
    mockConsultationService.getConsultation.mockResolvedValue({ ...baseConsultation })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/consultations/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(CONSULT_ID)
  })

  it('returns 403 for non-participant', async () => {
    mockConsultationService.getConsultation.mockRejectedValue(
      new ConsultationError('NOT_PARTICIPANT', 'Not a participant')
    )
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/consultations/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken('other-user', Role.patient)}`)
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/consultations/:id/accept', () => {
  it('returns 403 when caller is not a doctor', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/accept`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('accepts consultation and returns updated', async () => {
    mockConsultationService.acceptConsultation.mockResolvedValue({
      ...baseConsultation, status: ConsultationStatus.active, doctor_id: DOC_ID,
    })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/accept`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('active')
  })

  it('returns 409 when consultation not pending', async () => {
    mockConsultationService.acceptConsultation.mockRejectedValue(
      new ConsultationError('WRONG_STATUS', 'Must be pending')
    )
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/accept`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/consultations/:id/complete', () => {
  it('completes consultation and returns consultation + prescription', async () => {
    mockConsultationService.completeConsultation.mockResolvedValue({
      consultation: { ...baseConsultation, status: ConsultationStatus.completed },
      prescription: { id: 'presc-1', qr_code: 'ABC123', medications: [], valid_until: new Date(), created_at: new Date(), consultation_id: CONSULT_ID, instructions: null },
    })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/complete`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ diagnosis: 'flu', medications: [{ name: 'Ibuprofeno', dose: '400mg', frequency: 'every 8h' }] })
    expect(res.status).toBe(200)
    expect(res.body.consultation.status).toBe('completed')
    expect(res.body.prescription.qr_code).toBeTruthy()
  })

  it('returns 400 when diagnosis is missing', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/complete`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ medications: [] })
    expect(res.status).toBe(400)
  })
})
