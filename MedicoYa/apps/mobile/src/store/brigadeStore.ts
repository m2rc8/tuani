import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import type { BrigadeInfo, OfflineConsultation } from '../lib/types'

const STORAGE_KEY = 'brigade_store'

interface PersistedState {
  activeBrigade: BrigadeInfo | null
  brigades: BrigadeInfo[]
  patientCache: { phone: string; name: string }[]
  offlineQueue: OfflineConsultation[]
  lastSyncedAt: string | null
}

interface BrigadeState {
  activeBrigade: BrigadeInfo | null
  brigades: BrigadeInfo[]
  patientCache: { phone: string; name: string }[]
  offlineQueue: OfflineConsultation[]
  syncState: 'idle' | 'syncing' | 'error'
  lastSyncedAt: string | null

  setActiveBrigade: (brigade: BrigadeInfo, patients: { phone: string; name: string }[]) => Promise<void>
  clearActiveBrigade: () => Promise<void>
  setBrigades: (brigades: BrigadeInfo[]) => void
  addConsultation: (c: Omit<OfflineConsultation, 'local_id' | 'synced' | 'sync_error'>) => string
  markSynced: (local_ids: string[]) => Promise<void>
  markRejected: (items: { local_id: string; reason: string }[]) => Promise<void>
  setSyncState: (state: 'idle' | 'syncing' | 'error') => void
  setLastSyncedAt: (at: string) => void
  hydrate: () => Promise<void>
}

async function persist(state: PersistedState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useBrigadeStore = create<BrigadeState>((set, get) => ({
  activeBrigade: null,
  brigades: [],
  patientCache: [],
  offlineQueue: [],
  syncState: 'idle',
  lastSyncedAt: null,

  setActiveBrigade: async (brigade, patients) => {
    const { brigades, offlineQueue, lastSyncedAt } = get()
    await persist({ activeBrigade: brigade, brigades, patientCache: patients, offlineQueue, lastSyncedAt })
    set({ activeBrigade: brigade, patientCache: patients })
  },

  clearActiveBrigade: async () => {
    const { brigades, offlineQueue, lastSyncedAt } = get()
    await persist({ activeBrigade: null, brigades, patientCache: [], offlineQueue, lastSyncedAt })
    set({ activeBrigade: null, patientCache: [] })
  },

  setBrigades: (brigades) => {
    const { activeBrigade, patientCache, offlineQueue, lastSyncedAt } = get()
    persist({ activeBrigade, brigades, patientCache, offlineQueue, lastSyncedAt }).catch(() => {})
    set({ brigades })
  },

  addConsultation: (c) => {
    const local_id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const item: OfflineConsultation = { ...c, local_id, synced: false }
    const newQueue = [item, ...get().offlineQueue]
    set({ offlineQueue: newQueue })
    const { activeBrigade, brigades, patientCache, lastSyncedAt } = get()
    persist({ activeBrigade, brigades, patientCache, offlineQueue: newQueue, lastSyncedAt }).catch(() => {})
    return local_id
  },

  markSynced: async (local_ids) => {
    const idSet = new Set(local_ids)
    const { activeBrigade, brigades, patientCache, lastSyncedAt } = get()
    const newQueue = get().offlineQueue.map(c =>
      idSet.has(c.local_id) ? { ...c, synced: true, sync_error: undefined } : c
    )
    await persist({ activeBrigade, brigades, patientCache, offlineQueue: newQueue, lastSyncedAt })
    set({ offlineQueue: newQueue })
  },

  markRejected: async (items) => {
    const errMap = new Map(items.map(i => [i.local_id, i.reason]))
    const { activeBrigade, brigades, patientCache, lastSyncedAt } = get()
    const newQueue = get().offlineQueue.map(c =>
      errMap.has(c.local_id) ? { ...c, sync_error: errMap.get(c.local_id) } : c
    )
    await persist({ activeBrigade, brigades, patientCache, offlineQueue: newQueue, lastSyncedAt })
    set({ offlineQueue: newQueue })
  },

  setSyncState: (syncState) => set({ syncState }),

  setLastSyncedAt: (lastSyncedAt) => {
    const { activeBrigade, brigades, patientCache, offlineQueue } = get()
    persist({ activeBrigade, brigades, patientCache, offlineQueue, lastSyncedAt }).catch(() => {})
    set({ lastSyncedAt })
  },

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const { activeBrigade, brigades, patientCache, offlineQueue, lastSyncedAt }: PersistedState = JSON.parse(raw)
    set({ activeBrigade, brigades, patientCache, offlineQueue, lastSyncedAt })
  },
}))
