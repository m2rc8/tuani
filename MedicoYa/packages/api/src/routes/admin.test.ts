import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language, ConsultationStatus, PaymentStatus } from '@prisma/client'

const SECRET   = 'test-secret-medicoya-min-32-chars-ok'
const ADMIN_ID = 'admin-uuid-1'
const DOC_ID   = 'doctor-uuid-1'
const PAT_ID   = 'patient-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockDb = {
  doctor: {
    findMany:   vi.fn(),
    update:     vi.fn(),
    findUnique: vi.fn(),
  },
  consultation: {
    findMany: vi.fn(),
  },
  rating: {
    groupBy: vi.fn().mockResolvedValue([]),
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
    mockDb.doctor.findMany.mockResolvedValue([{ id: DOC_ID, approved_at: null, rejected_at: null }])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(mockDb.doctor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { approved_at: null, rejected_at: null } })
    )
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

describe('GET /api/admin/doctors/approved', () => {
  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/approved')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns approved doctors for admin', async () => {
    mockDb.doctor.findMany.mockResolvedValue([
      { id: DOC_ID, approved_at: new Date(), available: true, user: { name: 'Dr. Juan', phone: '+50499000001' } },
    ])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/approved')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].available).toBe(true)
    expect(mockDb.doctor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { approved_at: { not: null }, rejected_at: null },
      })
    )
  })
})

describe('PUT /api/admin/doctors/:id/reject', () => {
  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/reject`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('sets rejected_at for admin', async () => {
    mockDb.doctor.update.mockResolvedValue({ id: DOC_ID, rejected_at: new Date() })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/reject`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(mockDb.doctor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DOC_ID },
        data:  expect.objectContaining({ rejected_at: expect.any(Date) }),
      })
    )
  })

  it('returns 404 when doctor not found', async () => {
    mockDb.doctor.update.mockRejectedValue(new Error('Not found'))
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/nonexistent/reject`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /api/admin/consultations', () => {
  const mockConsultation = {
    id: 'consult-1',
    status: ConsultationStatus.active,
    created_at: new Date(),
    payment_status: PaymentStatus.pending,
    patient: { id: PAT_ID, user: { name: 'María', phone: '+50499111111' } },
    doctor:  { id: DOC_ID, user: { name: 'Dr. Juan', phone: '+50499000001' } },
  }

  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/consultations')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns consultations for today when no date param', async () => {
    mockDb.consultation.findMany.mockResolvedValue([mockConsultation])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/consultations')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].status).toBe('active')
  })

  it('accepts explicit date param', async () => {
    mockDb.consultation.findMany.mockResolvedValue([])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/consultations?date=2026-01-01')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(mockDb.consultation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          created_at: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    )
  })
})
