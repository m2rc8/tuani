import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language, ConsultationStatus, PaymentStatus } from '@prisma/client'

const SECRET    = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID    = 'patient-uuid-1'
const DOC_ID    = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockConsultation = {
  id: CONSULT_ID, patient_id: PAT_ID, doctor_id: DOC_ID,
  status: ConsultationStatus.active,
  symptoms_text: 'headache', symptom_photo: null,
  diagnosis: null, diagnosis_code: null,
  price_lps: null, payment_status: PaymentStatus.pending,
  created_at: new Date(), completed_at: null,
}

const mockDb = {
  consultation: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  doctor: {
    findUnique: vi.fn(),
  },
  prescription: {
    findUnique: vi.fn(),
  },
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /fhir/R4/Encounter/:id', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).get(`/fhir/R4/Encounter/${CONSULT_ID}`)
    expect(res.status).toBe(401)
  })

  it('returns FHIR Encounter with correct Content-Type', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/fhir/R4/Encounter/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/fhir\+json/)
    expect(res.body.resourceType).toBe('Encounter')
    expect(res.body.status).toBe('in-progress')
  })

  it('returns 403 for non-participant', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/fhir/R4/Encounter/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken('other-user', Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when consultation does not exist', async () => {
    mockDb.consultation.findUnique.mockResolvedValue(null)
    const app = makeTestApp()
    const res = await request(app)
      .get(`/fhir/R4/Encounter/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /fhir/R4/Practitioner/:id', () => {
  it('returns FHIR Practitioner', async () => {
    mockDb.doctor.findUnique.mockResolvedValue({
      id: DOC_ID, cedula: '12345', cmh_verified: true, available: true, bio: null, approved_at: new Date(),
      user: { phone: '+50499000001', name: 'Dr. Juan', preferred_language: Language.es },
    })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/fhir/R4/Practitioner/${DOC_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.resourceType).toBe('Practitioner')
    expect(res.headers['content-type']).toMatch(/application\/fhir\+json/)
  })
})
