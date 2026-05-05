import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Mock i18n before importing authStore (authStore calls i18n.changeLanguage)
jest.mock('../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn().mockResolvedValue(undefined) },
}))

import i18n from '../i18n'
import { useAuthStore } from '../store/authStore'

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>

beforeEach(async () => {
  useAuthStore.setState({ token: null, userId: null, role: null, language: 'es' })
  jest.clearAllMocks()
  await AsyncStorage.clear()
})

describe('authStore.login', () => {
  it('stores token in SecureStore', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'patient', preferred_language: 'es',
    })
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith('auth_token', 'tok123')
  })

  it('stores user JSON in AsyncStorage', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'patient', preferred_language: 'es',
    })
    const raw = await AsyncStorage.getItem('auth_user')
    expect(JSON.parse(raw!)).toEqual({ userId: 'u1', role: 'patient', language: 'es' })
  })

  it('updates store state', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'doctor', preferred_language: 'en',
    })
    const { token, userId, role, language } = useAuthStore.getState()
    expect(token).toBe('tok123')
    expect(userId).toBe('u1')
    expect(role).toBe('doctor')
    expect(language).toBe('en')
  })

  it('calls i18n.changeLanguage with resolved language', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'patient', preferred_language: 'en',
    })
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  it('defaults unknown preferred_language to es', async () => {
    await useAuthStore.getState().login('tok123', {
      id: 'u1', role: 'patient', preferred_language: 'fr',
    })
    expect(useAuthStore.getState().language).toBe('es')
  })
})

describe('authStore.logout', () => {
  beforeEach(async () => {
    await useAuthStore.getState().login('tok', {
      id: 'u1', role: 'patient', preferred_language: 'es',
    })
    jest.clearAllMocks()
  })

  it('deletes token from SecureStore', async () => {
    await useAuthStore.getState().logout()
    expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith('auth_token')
  })

  it('removes user from AsyncStorage', async () => {
    await useAuthStore.getState().logout()
    expect(await AsyncStorage.getItem('auth_user')).toBeNull()
  })

  it('resets state to null', async () => {
    await useAuthStore.getState().logout()
    const { token, userId, role } = useAuthStore.getState()
    expect(token).toBeNull()
    expect(userId).toBeNull()
    expect(role).toBeNull()
  })
})

describe('authStore.setLanguage', () => {
  it('updates language in store', async () => {
    await useAuthStore.getState().setLanguage('en')
    expect(useAuthStore.getState().language).toBe('en')
  })

  it('calls i18n.changeLanguage', async () => {
    await useAuthStore.getState().setLanguage('en')
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  it('persists language in AsyncStorage when user exists', async () => {
    await AsyncStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 'u1', role: 'patient', language: 'es' }),
    )
    await useAuthStore.getState().setLanguage('en')
    const raw = await AsyncStorage.getItem('auth_user')
    expect(JSON.parse(raw!).language).toBe('en')
  })
})

describe('authStore.hydrate', () => {
  it('restores token and user from storage', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce('saved_token')
    await AsyncStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 'u2', role: 'doctor', language: 'en' }),
    )
    await useAuthStore.getState().hydrate()
    const { token, userId, role, language } = useAuthStore.getState()
    expect(token).toBe('saved_token')
    expect(userId).toBe('u2')
    expect(role).toBe('doctor')
    expect(language).toBe('en')
  })

  it('calls i18n.changeLanguage with stored language', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce('tok')
    await AsyncStorage.setItem(
      'auth_user',
      JSON.stringify({ userId: 'u1', role: 'patient', language: 'en' }),
    )
    await useAuthStore.getState().hydrate()
    expect(i18n.changeLanguage).toHaveBeenCalledWith('en')
  })

  it('does nothing when no stored token', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce(null)
    await useAuthStore.getState().hydrate()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('does nothing when token exists but user data missing', async () => {
    mockSecureStore.getItemAsync.mockResolvedValueOnce('tok')
    // AsyncStorage is clear — no auth_user
    await useAuthStore.getState().hydrate()
    expect(useAuthStore.getState().token).toBeNull()
  })
})
