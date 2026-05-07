import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { Role, Language } from '@prisma/client'
import { createBrigadesRouter } from './brigades'

const SECRET     = 'test-secret-medicoya-min-32-chars-ok'
const COORD_ID   = 'coord-uuid-1'
const DOC_ID     = 'doctor-uuid-1'
const PAT_ID     = 'patient-uuid-1'
const BRIGADE_ID = 'brigade-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockBrigade = {
  id:           BRIGADE_ID,
  name:         'Brigada Norte',
  organizer_id: COORD_ID,
  community:    'Comunidad X',
  municipality: null,
  department:   null,
  start_date:   new Date('2026-05-10'),
  end_date:     new Date('2026-05-12'),
  join_code:    'ABC123',
  status:       'active',
  created_at:   new Date(),
  doctors:      [],
}

const mockDb = {
  brigade: {
    create:     vi.fn(),
    findUnique: vi.fn(),
    findFirst:  vi.fn(),
  },
  brigadeDoctor: {
    findUnique: vi.fn(),
    create:     vi.fn(),
    findMany:   vi.fn(),
  },
  consultation: {
    count:    vi.fn(),
    findMany: vi.fn(),
    groupBy:  vi.fn(),
  },
  patient: {
    count: vi.fn(),
  },
}

function makeTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/brigades', createBrigadesRouter(mockDb as any))
  return app
}

beforeEach(() => { vi.clearAllMocks() })

// --- POST / ---

describe('POST /api/brigades', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp())
      .post('/api/brigades')
      .send({ name: 'X', community: 'Y', start_date: '2026-05-10T00:00:00Z', end_date: '2026-05-12T00:00:00Z' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for patient role', async () => {
    const res = await request(makeTestApp())
      .post('/api/brigades')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .send({ name: 'X', community: 'Y', start_date: '2026-05-10T00:00:00Z', end_date: '2026-05-12T00:00:00Z' })
    expect(res.status).toBe(403)
  })

  it('coordinator creates brigade — returns 201 with join_code', async () => {
    mockDb.brigade.create.mockResolvedValue({ ...mockBrigade, join_code: 'XYZ999' })
    const res = await request(makeTestApp())
      .post('/api/brigades')
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
      .send({ name: 'Brigada Norte', community: 'Comunidad X', start_date: '2026-05-10T00:00:00Z', end_date: '2026-05-12T00:00:00Z' })
    expect(res.status).toBe(201)
    expect(res.body.join_code).toBe('XYZ999')
  })
})

// --- GET /:id ---

describe('GET /api/brigades/:id', () => {
  it('returns 403 when caller is not member or owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, organizer_id: 'other', doctors: [] })
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with doctor list when coordinator owns brigade', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({
      ...mockBrigade,
      doctors: [{ doctor_id: DOC_ID, joined_at: new Date(), doctor: { user: { name: 'Dr. Juan' } } }],
    })
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(200)
    expect(res.body.doctors).toHaveLength(1)
    expect(res.body.doctors[0].doctor_id).toBe(DOC_ID)
    expect(res.body.doctors[0].name).toBe('Dr. Juan')
  })
})

// --- POST /:id/join ---

describe('POST /api/brigades/:id/join', () => {
  it('returns 400 for wrong join_code', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, join_code: 'ABC123' })
    const res = await request(makeTestApp())
      .post(`/api/brigades/${BRIGADE_ID}/join`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ join_code: 'WRONG1' })
    expect(res.status).toBe(400)
  })

  it('returns 409 when already joined', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, join_code: 'ABC123' })
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    const res = await request(makeTestApp())
      .post(`/api/brigades/${BRIGADE_ID}/join`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ join_code: 'ABC123' })
    expect(res.status).toBe(409)
  })

  it('returns 201 when doctor joins with correct code', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, join_code: 'ABC123' })
    mockDb.brigadeDoctor.findUnique.mockResolvedValue(null)
    mockDb.brigadeDoctor.create.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID, joined_at: new Date() })
    const res = await request(makeTestApp())
      .post(`/api/brigades/${BRIGADE_ID}/join`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ join_code: 'ABC123' })
    expect(res.status).toBe(201)
  })
})

// --- GET /:id/dashboard ---

describe('GET /api/brigades/:id/dashboard', () => {
  it('returns 403 for non-owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, organizer_id: 'other-coord' })
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}/dashboard`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with stats for brigade owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue(mockBrigade)
    mockDb.consultation.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
    mockDb.consultation.findMany.mockResolvedValue([{ doctor_id: DOC_ID }])
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}/dashboard`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ total: 10, attended: 7, waiting: 3, active_doctors: 1 })
  })
})

// --- GET /:id/report ---

describe('GET /api/brigades/:id/report', () => {
  it('returns 403 for non-owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, organizer_id: 'other-coord' })
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}/report`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with top_diagnoses for brigade owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue(mockBrigade)
    mockDb.consultation.groupBy.mockResolvedValue([
      { diagnosis: 'Hypertension', _count: { diagnosis: 5 } },
    ])
    mockDb.patient.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}/report`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(200)
    expect(res.body.patient_count).toBe(8)
    expect(res.body.by_registration_mode).toEqual({ self: 3, brigade_doctor: 5 })
    expect(res.body.top_diagnoses).toHaveLength(1)
    expect(res.body.top_diagnoses[0]).toEqual({ diagnosis: 'Hypertension', count: 5 })
  })
})

// --- GET / (list mine) ---

describe('GET /api/brigades', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).get('/api/brigades')
    expect(res.status).toBe(401)
  })

  it('returns brigade list for doctor', async () => {
    mockDb.brigadeDoctor.findMany.mockResolvedValue([
      {
        brigade_id: BRIGADE_ID,
        doctor_id:  DOC_ID,
        joined_at:  new Date('2026-05-06'),
        brigade:    { id: BRIGADE_ID, name: 'Brigada Norte', community: 'Comunidad X', status: 'active' },
      },
    ])
    const res = await request(makeTestApp())
      .get('/api/brigades')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(BRIGADE_ID)
    expect(res.body[0].name).toBe('Brigada Norte')
  })
})

// --- GET /by-code/:code ---

describe('GET /api/brigades/by-code/:code', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).get('/api/brigades/by-code/ABC123')
    expect(res.status).toBe(401)
  })

  it('returns 200 with brigade info when code exists', async () => {
    mockDb.brigade.findFirst.mockResolvedValue({
      id: BRIGADE_ID, name: 'Brigada Norte', community: 'Comunidad X',
      municipality: null, department: null, status: 'active',
      start_date: new Date('2026-05-10'), end_date: new Date('2026-05-12'),
    })
    const res = await request(makeTestApp())
      .get('/api/brigades/by-code/ABC123')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(BRIGADE_ID)
    expect(res.body.name).toBe('Brigada Norte')
  })

  it('returns 404 when code does not exist', async () => {
    mockDb.brigade.findFirst.mockResolvedValue(null)
    const res = await request(makeTestApp())
      .get('/api/brigades/by-code/XXXXXX')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(404)
  })
})
