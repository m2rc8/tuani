import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, mockIsExpoPushToken } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockIsExpoPushToken: vi.fn(),
}))

vi.mock('expo-server-sdk', () => ({
  default: class MockExpo {
    static isExpoPushToken = mockIsExpoPushToken
    sendPushNotificationsAsync = mockSend
  },
}))

import { NotificationService } from './NotificationService'

const mockDb = {
  pushToken: {
    findMany: vi.fn(),
    delete:   vi.fn().mockResolvedValue({}),
  },
}

function makeService() {
  return new NotificationService(mockDb as any)
}

const msg = {
  es: { title: 'Titulo', body: 'Cuerpo' },
  en: { title: 'Title',  body: 'Body'  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockIsExpoPushToken.mockReturnValue(true)
  mockSend.mockResolvedValue([{ status: 'ok' }])
})

describe('NotificationService', () => {
  it('sends push with localized string matching user preferred_language', async () => {
    mockDb.pushToken.findMany.mockResolvedValue([
      { id: 'tok-1', token: 'ExponentPushToken[abc]', user: { preferred_language: 'en' } },
    ])
    const svc = makeService()
    await svc.sendToUser('user-1', msg)
    expect(mockSend).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[abc]', title: 'Title', body: 'Body' }),
    ])
  })

  it('filters out invalid Expo tokens and skips send', async () => {
    mockIsExpoPushToken.mockReturnValue(false)
    mockDb.pushToken.findMany.mockResolvedValue([
      { id: 'tok-1', token: 'invalid-token', user: { preferred_language: 'es' } },
    ])
    const svc = makeService()
    await svc.sendToUser('user-1', msg)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('deletes token on DeviceNotRegistered error', async () => {
    mockDb.pushToken.findMany.mockResolvedValue([
      { id: 'tok-1', token: 'ExponentPushToken[abc]', user: { preferred_language: 'es' } },
    ])
    mockSend.mockResolvedValue([{
      status: 'error',
      details: { error: 'DeviceNotRegistered' },
    }])
    const svc = makeService()
    await svc.sendToUser('user-1', msg)
    expect(mockDb.pushToken.delete).toHaveBeenCalledWith({ where: { id: 'tok-1' } })
  })
})
