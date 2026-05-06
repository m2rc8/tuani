import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'

const SECRET  = 'test-secret-medicoya-min-32-chars-ok'
const DOC_ID  = 'doctor-uuid-1'
const PAT_ID  = 'patient-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockDoctor = {
  id: DOC_ID, cedula: '12345', cmh_verified: true,
  available: true, bio: null, approved_at: new Date(),
  user: { name: 'Dr. Juan', phone: '+50499000001' },
}

const mockDb = {
  doctor: {
    findMany: vi.fn(),
    update:   vi.fn(),
    findUnique: vi.fn(),
  },
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/doctors/available', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).get('/api/doctors/available')
    expect(res.status).toBe(401)
  })

  it('returns available approved doctors', async () => {
    mockDb.doctor.findMany.mockResolvedValue([mockDoctor])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/doctors/available')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(DOC_ID)
  })
})

describe('PUT /api/doctors/availability', () => {
  it('returns 403 when caller is not a doctor', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put('/api/doctors/availability')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .send({ available: false })
    expect(res.status).toBe(403)
  })

  it('updates available field for doctor', async () => {
    mockDb.doctor.update.mockResolvedValue({ ...mockDoctor, available: false })
    const app = makeTestApp()
    const res = await request(app)
      .put('/api/doctors/availability')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ available: false })
    expect(res.status).toBe(200)
    expect(mockDb.doctor.update).toHaveBeenCalledWith({
      where: { id: DOC_ID },
      data:  { available: false },
    })
  })
})

describe('GET /api/doctors/me', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).get('/api/doctors/me')
    expect(res.status).toBe(401)
  })

  it('returns 403 when caller is not a doctor', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/doctors/me')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns current doctor profile', async () => {
    mockDb.doctor.findUnique.mockResolvedValue(mockDoctor)
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/doctors/me')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(DOC_ID)
    expect(res.body.available).toBe(true)
    expect(mockDb.doctor.findUnique).toHaveBeenCalledWith({
      where:   { id: DOC_ID },
      include: { user: { select: { name: true, phone: true } } },
    })
  })

  it('returns 404 when doctor record not found', async () => {
    mockDb.doctor.findUnique.mockResolvedValue(null)
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/doctors/me')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(404)
  })
})
