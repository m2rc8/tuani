import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { Role, Language } from '@prisma/client'
import { createSyncRouter } from './sync'

const SECRET     = 'test-secret-medicoya-min-32-chars-ok'
const DOC_ID     = 'doctor-uuid-1'
const PAT_ID     = 'patient-uuid-1'
const BRIGADE_ID = '00000000-0000-0000-0000-000000000001'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const validItem = {
  local_id:      'local-1',
  patient_phone: '+50499111111',
  patient_name:  'María López',
  symptoms_text: 'Headache',
  diagnosis:     'Tension headache',
  created_at:    '2026-05-10T10:00:00Z',
}

const mockDb = {
  brigade: {
    findUnique: vi.fn(),
  },
  brigadeDoctor: {
    findUnique: vi.fn(),
  },
  user: {
    upsert: vi.fn(),
  },
  patient: {
    upsert: vi.fn(),
  },
  consultation: {
    create: vi.fn(),
  },
  prescription: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

function makeTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/sync', createSyncRouter(mockDb as any))
  return app
}

beforeEach(() => { vi.clearAllMocks() })

// --- POST /consultations ---

describe('POST /api/sync/consultations', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .send({ brigade_id: BRIGADE_ID, consultations: [] })
    expect(res.status).toBe(401)
  })

  it('returns 403 when doctor is not a brigade member', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue(null)
    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ brigade_id: BRIGADE_ID, consultations: [] })
    expect(res.status).toBe(403)
  })

  it('returns 200 with empty arrays for empty consultation list', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ brigade_id: BRIGADE_ID, consultations: [] })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ accepted: [], rejected: [] })
  })

  it('returns 200 with all 3 local_ids in accepted for valid consultations', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    mockDb.user.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.patient.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb))
    mockDb.consultation.create.mockResolvedValue({ id: 'cons-1' })

    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({
        brigade_id: BRIGADE_ID,
        consultations: [
          { ...validItem, local_id: 'local-1' },
          { ...validItem, local_id: 'local-2', patient_phone: '+50499222222' },
          { ...validItem, local_id: 'local-3', patient_phone: '+50499333333' },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toHaveLength(3)
    expect(res.body.accepted).toContain('local-1')
    expect(res.body.accepted).toContain('local-2')
    expect(res.body.accepted).toContain('local-3')
    expect(res.body.rejected).toHaveLength(0)
  })

  it('accepts both when same patient_phone appears twice — links to same patient row', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    mockDb.user.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.patient.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb))
    mockDb.consultation.create.mockResolvedValue({ id: 'cons-1' })

    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({
        brigade_id: BRIGADE_ID,
        consultations: [
          { ...validItem, local_id: 'local-1', patient_phone: '+50499111111' },
          { ...validItem, local_id: 'local-2', patient_phone: '+50499111111' },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toHaveLength(2)
    expect(res.body.rejected).toHaveLength(0)
    expect(mockDb.user.upsert).toHaveBeenCalledTimes(2)
  })

  it('returns 200 with 1 accepted and 1 rejected when one item fails', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    mockDb.user.upsert
      .mockResolvedValueOnce({ id: PAT_ID })
      .mockRejectedValueOnce(new Error('DB connection lost'))
    mockDb.patient.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb))
    mockDb.consultation.create.mockResolvedValue({ id: 'cons-1' })

    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({
        brigade_id: BRIGADE_ID,
        consultations: [
          { ...validItem, local_id: 'local-1' },
          { ...validItem, local_id: 'local-2', patient_phone: '+50499222222' },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toContain('local-1')
    expect(res.body.rejected).toHaveLength(1)
    expect(res.body.rejected[0].local_id).toBe('local-2')
    expect(res.body.rejected[0].reason).toBe('DB connection lost')
  })
})

// --- GET /brigade/:id ---

describe('GET /api/sync/brigade/:id', () => {
  it('returns 200 with brigade + doctor list for member', async () => {
    const brigadeId = 'brigade-uuid-1'
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: brigadeId, doctor_id: DOC_ID })
    mockDb.brigade.findUnique.mockResolvedValue({
      id:           brigadeId,
      name:         'Brigada Norte',
      community:    'Comunidad X',
      municipality: null,
      department:   null,
      start_date:   new Date('2026-05-10'),
      end_date:     new Date('2026-05-12'),
      status:       'active',
      doctors: [{ doctor_id: DOC_ID, doctor: { user: { name: 'Dr. Juan' } } }],
    })
    const res = await request(makeTestApp())
      .get(`/api/sync/brigade/${brigadeId}`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.brigade.name).toBe('Brigada Norte')
    expect(res.body.doctors).toHaveLength(1)
    expect(res.body.doctors[0].id).toBe(DOC_ID)
    expect(res.body.doctors[0].name).toBe('Dr. Juan')
  })
})
