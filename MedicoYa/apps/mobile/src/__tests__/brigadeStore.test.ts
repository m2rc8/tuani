import AsyncStorage from '@react-native-async-storage/async-storage'
import { useBrigadeStore } from '../store/brigadeStore'
import type { BrigadeInfo, OfflineConsultation } from '../lib/types'

const brigade: BrigadeInfo = { id: 'b1', name: 'Brigada Norte', community: 'Comunidad X', status: 'active' }
const patients = [{ phone: '+50499111111', name: 'María' }]

const baseItem: Omit<OfflineConsultation, 'local_id' | 'synced' | 'sync_error'> = {
  patient_phone: '+50499111111',
  patient_name: 'María López',
  medications: [],
  created_at: '2026-05-06T10:00:00Z',
}

const STORAGE_KEY = 'brigade_store'

beforeEach(async () => {
  useBrigadeStore.setState({
    activeBrigade: null,
    brigades: [],
    patientCache: [],
    offlineQueue: [],
    syncState: 'idle',
    lastSyncedAt: null,
  })
  await AsyncStorage.clear()
  jest.clearAllMocks()
})

describe('setActiveBrigade', () => {
  it('sets activeBrigade and patientCache in state', async () => {
    await useBrigadeStore.getState().setActiveBrigade(brigade, patients)
    expect(useBrigadeStore.getState().activeBrigade).toEqual(brigade)
    expect(useBrigadeStore.getState().patientCache).toEqual(patients)
  })

  it('persists to AsyncStorage', async () => {
    await useBrigadeStore.getState().setActiveBrigade(brigade, patients)
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed.activeBrigade.id).toBe('b1')
    expect(parsed.patientCache).toHaveLength(1)
  })
})

describe('clearActiveBrigade', () => {
  it('nulls activeBrigade and empties patientCache', async () => {
    await useBrigadeStore.getState().setActiveBrigade(brigade, patients)
    await useBrigadeStore.getState().clearActiveBrigade()
    expect(useBrigadeStore.getState().activeBrigade).toBeNull()
    expect(useBrigadeStore.getState().patientCache).toHaveLength(0)
  })
})

describe('addConsultation', () => {
  it('adds item to offlineQueue and returns local_id', async () => {
    const local_id = useBrigadeStore.getState().addConsultation(baseItem)
    await Promise.resolve() // flush microtask so persist() fires
    expect(typeof local_id).toBe('string')
    expect(local_id.length).toBeGreaterThan(0)
    const queue = useBrigadeStore.getState().offlineQueue
    expect(queue).toHaveLength(1)
    expect(queue[0].local_id).toBe(local_id)
    expect(queue[0].synced).toBe(false)
    expect(queue[0].patient_name).toBe('María López')
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.offlineQueue).toHaveLength(1)
  })

  it('prepends new item to existing queue', () => {
    useBrigadeStore.getState().addConsultation(baseItem)
    useBrigadeStore.getState().addConsultation({ ...baseItem, patient_name: 'Juan' })
    const queue = useBrigadeStore.getState().offlineQueue
    expect(queue[0].patient_name).toBe('Juan')
    expect(queue).toHaveLength(2)
  })
})

describe('markSynced', () => {
  it('flips synced flag for matching local_ids', async () => {
    useBrigadeStore.getState().addConsultation(baseItem)
    const queue = useBrigadeStore.getState().offlineQueue
    const local_id = queue[0].local_id
    await useBrigadeStore.getState().markSynced([local_id])
    expect(useBrigadeStore.getState().offlineQueue[0].synced).toBe(true)
  })

  it('leaves unmatched items untouched', async () => {
    useBrigadeStore.getState().addConsultation(baseItem)
    await useBrigadeStore.getState().markSynced(['nonexistent'])
    expect(useBrigadeStore.getState().offlineQueue[0].synced).toBe(false)
  })
})

describe('markRejected', () => {
  it('sets sync_error on matching items without marking as synced', async () => {
    useBrigadeStore.getState().addConsultation(baseItem)
    const local_id = useBrigadeStore.getState().offlineQueue[0].local_id
    await useBrigadeStore.getState().markRejected([{ local_id, reason: 'DB error' }])
    const item = useBrigadeStore.getState().offlineQueue[0]
    expect(item.sync_error).toBe('DB error')
    expect(item.synced).toBe(false)
  })
})

describe('hydrate', () => {
  it('restores activeBrigade and offlineQueue from AsyncStorage', async () => {
    const stored = {
      activeBrigade: brigade,
      patientCache: patients,
      offlineQueue: [{ ...baseItem, local_id: 'x1', synced: false }],
      brigades: [brigade],
      lastSyncedAt: '2026-05-06T10:00:00Z',
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    await useBrigadeStore.getState().hydrate()
    expect(useBrigadeStore.getState().activeBrigade?.id).toBe('b1')
    expect(useBrigadeStore.getState().offlineQueue).toHaveLength(1)
    expect(useBrigadeStore.getState().brigades).toHaveLength(1)
    expect(useBrigadeStore.getState().lastSyncedAt).toBe('2026-05-06T10:00:00Z')
  })

  it('does nothing when storage is empty', async () => {
    await useBrigadeStore.getState().hydrate()
    expect(useBrigadeStore.getState().activeBrigade).toBeNull()
  })
})
