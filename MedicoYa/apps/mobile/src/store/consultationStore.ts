import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import type { ConsultationStatus, Message } from '../lib/types'

interface ConsultationState {
  activeConsultationId: string | null
  status: ConsultationStatus | null
  messages: Message[]
  setActive: (id: string, status: ConsultationStatus) => Promise<void>
  appendMessage: (msg: Message) => void
  setStatus: (status: ConsultationStatus) => Promise<void>
  clear: () => Promise<void>
  hydrate: () => Promise<void>
}

const STORAGE_KEY = 'active_consultation'

export const useConsultationStore = create<ConsultationState>((set) => ({
  activeConsultationId: null,
  status: null,
  messages: [],

  setActive: async (id, status) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ id, status }))
    set({ activeConsultationId: id, status, messages: [] })
  },

  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  setStatus: async (status) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, status }))
    }
    set({ status })
  },

  clear: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY)
    set({ activeConsultationId: null, status: null, messages: [] })
  },

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const { id, status } = JSON.parse(raw)
    set({ activeConsultationId: id, status })
  },
}))
