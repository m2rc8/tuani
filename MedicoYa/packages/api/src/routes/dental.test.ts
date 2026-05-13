import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import jwt from 'jsonwebtoken'
import { Role, Language } from '@prisma/client'
import { createDentalRouter } from './dental'

const SECRET  = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID  = 'patient-uuid-1'
const FILE_ID = 'file-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockFile = {
  id: FILE_ID, patient_id: PAT_ID,
  created_at: new Date(), updated_at: new Date(),
  teeth: [], visits: [],
}

const mockDb = {
  dentalPatientFile: { findUnique: vi.fn(), create: vi.fn() },
  toothRecord:       { upsert: vi.fn() },
  dentalVisit:       { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  dentalTreatment:   { create: vi.fn(), update: vi.fn() },
  user:              { findMany: vi.fn(), create: vi.fn() },
}

function makeTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/dental', createDentalRouter(mockDb as any))
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/dental/files/mine', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).get('/api/dental/files/mine')
    expect(res.status).toBe(401)
  })

  it('returns 404 when patient has no file', async () => {
    mockDb.dentalPatientFile.findUnique.mockResolvedValue(null)
    const res = await request(makeTestApp())
      .get('/api/dental/files/mine')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(404)
  })

  it('returns file when patient has one', async () => {
    mockDb.dentalPatientFile.findUnique.mockResolvedValue(mockFile)
    const res = await request(makeTestApp())
      .get('/api/dental/files/mine')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(FILE_ID)
    expect(res.body.patient_id).toBe(PAT_ID)
  })

  it('queries by authenticated user sub as patient_id', async () => {
    mockDb.dentalPatientFile.findUnique.mockResolvedValue(mockFile)
    await request(makeTestApp())
      .get('/api/dental/files/mine')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(mockDb.dentalPatientFile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { patient_id: PAT_ID } })
    )
  })
})
