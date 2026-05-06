import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language, ConsultationStatus } from '@prisma/client'

const SECRET  = 'test-secret-medicoya-min-32-chars-ok'
const PATIENT = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const DOCTOR  = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
const CONS_ID = '550e8400-e29b-41d4-a716-446655440000'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const completedConsultation = {
  id:         CONS_ID,
  patient_id: PATIENT,
  doctor_id:  DOCTOR,
  status:     ConsultationStatus.completed,
}

const mockDb = {
  consultation: { findUnique: vi.fn() },
  rating:       { create: vi.fn().mockResolvedValue({ id: 'r-1' }) },
}

function makeApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.consultation.findUnique.mockResolvedValue(completedConsultation)
  mockDb.rating.create.mockResolvedValue({ id: 'r-1' })
})

describe('POST /api/ratings', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).post('/api/ratings').send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(401)
  })

  it('returns 403 for doctor role', async () => {
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(DOCTOR, Role.doctor)}`)
      .send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid stars (0)', async () => {
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 0 })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid stars (6)', async () => {
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 6 })
    expect(res.status).toBe(400)
  })

  it('returns 404 when consultation not found', async () => {
    mockDb.consultation.findUnique.mockResolvedValue(null)
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(404)
  })

  it('returns 403 when patient does not own consultation', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...completedConsultation, patient_id: 'other-patient' })
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(403)
  })

  it('returns 409 when consultation not completed', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...completedConsultation, status: ConsultationStatus.active })
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(409)
  })

  it('returns 201 on success with stars and comment', async () => {
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 4, comment: 'Great doctor' })
    expect(res.status).toBe(201)
    expect(mockDb.rating.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        consultation_id: CONS_ID,
        doctor_id:       DOCTOR,
        patient_id:      PATIENT,
        stars:           4,
        comment:         'Great doctor',
      }),
    }))
  })

  it('returns 409 on duplicate rating (P2002)', async () => {
    mockDb.rating.create.mockRejectedValue({ code: 'P2002' })
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 5 })
    expect(res.status).toBe(409)
  })
})
