import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import i18n from '../i18n'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

interface StoredUser {
  userId: string
  role: 'patient' | 'doctor'
  language: 'es' | 'en'
}

interface AuthState {
  token: string | null
  userId: string | null
  role: 'patient' | 'doctor' | null
  language: 'es' | 'en'
  login: (token: string, user: { id: string; role: string; preferred_language: string }) => Promise<void>
  logout: () => Promise<void>
  setLanguage: (lang: 'es' | 'en') => Promise<void>
  hydrate: () => Promise<void>
}

function resolveLang(raw: string): 'es' | 'en' {
  return raw === 'en' ? 'en' : 'es'
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  role: null,
  language: 'es',

  login: async (token, user) => {
    const language = resolveLang(user.preferred_language)
    const stored: StoredUser = { userId: user.id, role: user.role as 'patient' | 'doctor', language }
    await SecureStore.setItemAsync(TOKEN_KEY, token)
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(stored))
    set({ token, userId: user.id, role: stored.role, language })
    await i18n.changeLanguage(language)
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
    await AsyncStorage.removeItem(USER_KEY)
    set({ token: null, userId: null, role: null, language: 'es' })
  },

  setLanguage: async (lang) => {
    const raw = await AsyncStorage.getItem(USER_KEY)
    if (raw) {
      const parsed: StoredUser = JSON.parse(raw)
      await AsyncStorage.setItem(USER_KEY, JSON.stringify({ ...parsed, language: lang }))
    }
    set({ language: lang })
    await i18n.changeLanguage(lang)
  },

  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY)
    const raw = await AsyncStorage.getItem(USER_KEY)
    if (!token || !raw) return
    const { userId, role, language }: StoredUser = JSON.parse(raw)
    set({ token, userId, role, language })
    await i18n.changeLanguage(language)
  },
}))
