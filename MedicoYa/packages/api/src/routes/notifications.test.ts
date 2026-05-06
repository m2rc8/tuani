import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'

const SECRET = 'test-secret-medicoya-min-32-chars-ok'
const USER_ID = 'user-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockDb = {
  pushToken: { upsert: vi.fn().mockResolvedValue({}) },
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/notifications/token', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).post('/api/notifications/token').send({ token: 'ExponentPushToken[abc]' })
    expect(res.status).toBe(401)
  })

  it('returns 400 with missing token', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/notifications/token')
      .set('Authorization', `Bearer ${makeToken(USER_ID, Role.patient)}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('returns 400 with invalid Expo token format', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/notifications/token')
      .set('Authorization', `Bearer ${makeToken(USER_ID, Role.patient)}`)
      .send({ token: 'not-an-expo-token' })
    expect(res.status).toBe(400)
  })

  it('returns 204 and upserts token for authenticated user', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/notifications/token')
      .set('Authorization', `Bearer ${makeToken(USER_ID, Role.patient)}`)
      .send({ token: 'ExponentPushToken[abc]' })
    expect(res.status).toBe(204)
    expect(mockDb.pushToken.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where:  { token: 'ExponentPushToken[abc]' },
      create: expect.objectContaining({ user_id: USER_ID, token: 'ExponentPushToken[abc]' }),
      update: expect.objectContaining({ user_id: USER_ID }),
    }))
  })

  it('returns 204 and reassigns existing token to new user (shared device)', async () => {
    const OTHER_USER = 'other-user-uuid'
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/notifications/token')
      .set('Authorization', `Bearer ${makeToken(OTHER_USER, Role.doctor)}`)
      .send({ token: 'ExponentPushToken[abc]' })
    expect(res.status).toBe(204)
    expect(mockDb.pushToken.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ user_id: OTHER_USER }),
    }))
  })
})
