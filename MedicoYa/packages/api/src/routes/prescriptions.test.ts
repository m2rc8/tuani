import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'
import { PrescriptionError } from '../services/PrescriptionService'

const SECRET    = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID    = 'patient-uuid-1'
const PRESC_ID  = 'presc-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockPrescription = {
  id: PRESC_ID,
  consultation_id: 'consult-uuid-1',
  qr_code: 'ABC123XYZ0',
  medications: [{ name: 'Paracetamol', dose: '500mg', frequency: 'every 6h' }],
  instructions: null,
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  created_at: new Date(),
}

const mockPrescriptionService = {
  getPrescription: vi.fn(),
  getQrPng:        vi.fn(),
}

function makeTestApp() {
  const { app } = createApp({ prescriptionService: mockPrescriptionService as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/prescriptions/:id', () => {
  it('returns prescription for participant', async () => {
    mockPrescriptionService.getPrescription.mockResolvedValue({ ...mockPrescription })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/prescriptions/${PRESC_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(PRESC_ID)
  })

  it('returns 403 for non-participant', async () => {
    mockPrescriptionService.getPrescription.mockRejectedValue(
      new PrescriptionError('NOT_PARTICIPANT', 'Not a participant')
    )
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/prescriptions/${PRESC_ID}`)
      .set('Authorization', `Bearer ${makeToken('other', Role.patient)}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/prescriptions/:id/qr', () => {
  it('returns PNG buffer with correct content-type', async () => {
    mockPrescriptionService.getQrPng.mockResolvedValue(Buffer.from('fake-png'))
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/prescriptions/${PRESC_ID}/qr`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/png/)
  })
})
