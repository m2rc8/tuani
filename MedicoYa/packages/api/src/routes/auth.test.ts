import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../app'
import { AuthService } from '../services/AuthService'
import { DevOtpService } from '../services/OtpService'
import { Language, Role } from '@prisma/client'

const mockUser = {
  id: 'user-uuid-1',
  phone: '',
  name: null,
  role: Role.patient,
  preferred_language: Language.es,
  created_at: new Date(),
}

const mockPrisma = {
  user: {
    upsert: vi.fn().mockImplementation(({ where }) => {
      return Promise.resolve({ ...mockUser, phone: where.phone })
    }),
  },
}

function makeTestApp() {
  const otp = new DevOtpService()
  const authService = new AuthService(otp, mockPrisma as any)
  return { app: createApp({ authService }), otp }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/auth/send-otp', () => {
  it('returns 200 for valid Honduras phone', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: '+50499000000' })
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 for invalid phone format', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({ phone: 'not-a-phone' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when phone is missing', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/send-otp')
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/verify-otp', () => {
  it('returns 200 with token for correct code', async () => {
    const { app } = makeTestApp()
    await request(app).post('/api/auth/send-otp').send({ phone: '+50499000001' })
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+50499000001', code: '123456' })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeTruthy()
    expect(res.body.user.role).toBe('patient')
  })

  it('returns 401 for wrong code', async () => {
    const { app } = makeTestApp()
    await request(app).post('/api/auth/send-otp').send({ phone: '+50499000002' })
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+50499000002', code: '000000' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for code not yet requested', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+50499000003', code: '123456' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for code shorter than 6 digits', async () => {
    const { app } = makeTestApp()
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ phone: '+50499000004', code: '123' })
    expect(res.status).toBe(400)
  })

  it('sets preferred_language from Accept-Language header', async () => {
    const { app } = makeTestApp()
    await request(app).post('/api/auth/send-otp').send({ phone: '+50499000005' })
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .set('Accept-Language', 'en-US')
      .send({ phone: '+50499000005', code: '123456' })
    expect(res.status).toBe(200)
    expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { preferred_language: Language.en },
      })
    )
  })
})

describe('GET /health', () => {
  it('returns ok', async () => {
    const { app } = makeTestApp()
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
