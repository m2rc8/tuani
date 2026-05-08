import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'
import { PatientError } from '../services/PatientService'

const SECRET  = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID  = 'patient-uuid-1'
const DOC_ID  = 'doctor-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const baseProfile = {
  name:      'María López',
  phone:     '+50499887766',
  dob:       new Date('1990-05-15'),
  allergies: 'Penicilina',
}

const mockPatientService = {
  getProfile:    vi.fn(),
  updateProfile: vi.fn(),
}

function makeTestApp() {
  const { app } = createApp({ patientService: mockPatientService as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/patients/me', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).get('/api/patients/me')
    expect(res.status).toBe(401)
  })

  it('returns 403 for doctor role', async () => {
    const res = await request(makeTestApp())
      .get('/api/patients/me')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with profile for patient', async () => {
    mockPatientService.getProfile.mockResolvedValue(baseProfile)
    const res = await request(makeTestApp())
      .get('/api/patients/me')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.phone).toBe(baseProfile.phone)
    expect(res.body.name).toBe(baseProfile.name)
    expect(mockPatientService.getProfile).toHaveBeenCalledWith(PAT_ID)
  })

  it('returns 404 when patient record not found', async () => {
    mockPatientService.getProfile.mockRejectedValue(new PatientError('NOT_FOUND', 'Patient not found'))
    const res = await request(makeTestApp())
      .get('/api/patients/me')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('PUT /api/patients/me', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).put('/api/patients/me').send({})
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid dob format', async () => {
    const res = await request(makeTestApp())
      .put('/api/patients/me')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .send({ dob: 'not-a-date' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 200 with updated profile', async () => {
    const updated = { ...baseProfile, name: 'María García' }
    mockPatientService.updateProfile.mockResolvedValue(updated)
    const res = await request(makeTestApp())
      .put('/api/patients/me')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .send({ name: 'María García', dob: '1990-05-15', allergies: 'Penicilina' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('María García')
    expect(mockPatientService.updateProfile).toHaveBeenCalledWith(
      PAT_ID,
      expect.objectContaining({ name: 'María García', dob: '1990-05-15' })
    )
  })

  it('returns 200 when clearing dob with null', async () => {
    mockPatientService.updateProfile.mockResolvedValue({ ...baseProfile, dob: null })
    const res = await request(makeTestApp())
      .put('/api/patients/me')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .send({ dob: null })
    expect(res.status).toBe(200)
    expect(res.body.dob).toBeNull()
  })
})
