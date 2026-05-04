import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'

const SECRET   = 'test-secret-medicoya-min-32-chars-ok'
const ADMIN_ID = 'admin-uuid-1'
const DOC_ID   = 'doctor-uuid-1'
const PAT_ID   = 'patient-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockDb = {
  doctor: {
    findMany:  vi.fn(),
    update:    vi.fn(),
    findUnique: vi.fn(),
  },
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/admin/doctors/pending', () => {
  it('returns 403 for patient role', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns 403 for doctor role', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(403)
  })

  it('returns pending doctors for admin', async () => {
    mockDb.doctor.findMany.mockResolvedValue([{ id: DOC_ID, approved_at: null }])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('PUT /api/admin/doctors/:id/approve', () => {
  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/approve`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('sets approved_at for admin', async () => {
    mockDb.doctor.update.mockResolvedValue({ id: DOC_ID, approved_at: new Date() })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/approve`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(mockDb.doctor.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DOC_ID } })
    )
  })
})
