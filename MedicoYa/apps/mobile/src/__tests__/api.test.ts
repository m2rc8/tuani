import AxiosMockAdapter from 'axios-mock-adapter'

jest.mock('../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

let mock: AxiosMockAdapter

beforeEach(() => {
  mock = new AxiosMockAdapter(api)
  useAuthStore.setState({ token: null, userId: null, role: null, language: 'es' })
  jest.clearAllMocks()
})

afterEach(() => {
  mock.restore()
})

describe('api request interceptor', () => {
  it('makes request without Authorization when no token', async () => {
    mock.onGet('/test').reply(200, {})
    const res = await api.get('/test')
    expect(res.config.headers?.Authorization).toBeUndefined()
  })

  it('injects Bearer token when token exists in store', async () => {
    useAuthStore.setState({ token: 'my-jwt', userId: null, role: null, language: 'es' })
    mock.onGet('/test').reply(200, {})
    const res = await api.get('/test')
    expect(res.config.headers?.Authorization).toBe('Bearer my-jwt')
  })
})

describe('api response interceptor', () => {
  it('passes through successful responses', async () => {
    mock.onGet('/test').reply(200, { ok: true })
    const res = await api.get('/test')
    expect(res.data).toEqual({ ok: true })
  })

  it('calls logout and rejects on 401', async () => {
    useAuthStore.setState({ token: 'expired', userId: 'u1', role: 'patient', language: 'es' })
    mock.onGet('/secure').reply(401)
    await expect(api.get('/secure')).rejects.toBeDefined()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('rejects non-401 errors without logging out', async () => {
    useAuthStore.setState({ token: 'valid', userId: 'u1', role: 'patient', language: 'es' })
    mock.onGet('/bad').reply(500)
    await expect(api.get('/bad')).rejects.toBeDefined()
    expect(useAuthStore.getState().token).toBe('valid')
  })
})
