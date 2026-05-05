import AsyncStorage from '@react-native-async-storage/async-storage'
import { useConsultationStore } from '../store/consultationStore'
import type { Message } from '../lib/types'

const STORAGE_KEY = 'active_consultation'

beforeEach(async () => {
  useConsultationStore.setState({
    activeConsultationId: null,
    status: null,
    messages: [],
  })
  await AsyncStorage.clear()
  jest.clearAllMocks()
})

const msg: Message = {
  id: 'm1', sender_id: 'u1', content: 'hello',
  msg_type: 'text', created_at: '2026-05-05T00:00:00Z',
}

describe('setActive', () => {
  it('updates state and persists to AsyncStorage', async () => {
    await useConsultationStore.getState().setActive('c1', 'pending')
    const { activeConsultationId, status } = useConsultationStore.getState()
    expect(activeConsultationId).toBe('c1')
    expect(status).toBe('pending')
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    expect(JSON.parse(raw!)).toEqual({ id: 'c1', status: 'pending' })
  })

  it('resets messages to empty array', async () => {
    useConsultationStore.setState({ messages: [msg] })
    await useConsultationStore.getState().setActive('c2', 'pending')
    expect(useConsultationStore.getState().messages).toHaveLength(0)
  })
})

describe('appendMessage', () => {
  it('appends message to messages array', () => {
    useConsultationStore.getState().appendMessage(msg)
    expect(useConsultationStore.getState().messages).toEqual([msg])
  })

  it('preserves existing messages', () => {
    const msg2: Message = { ...msg, id: 'm2', content: 'world' }
    useConsultationStore.getState().appendMessage(msg)
    useConsultationStore.getState().appendMessage(msg2)
    expect(useConsultationStore.getState().messages).toHaveLength(2)
  })
})

describe('setStatus', () => {
  it('updates status in state', async () => {
    await useConsultationStore.getState().setActive('c1', 'pending')
    await useConsultationStore.getState().setStatus('active')
    expect(useConsultationStore.getState().status).toBe('active')
  })

  it('updates persisted status in AsyncStorage', async () => {
    await useConsultationStore.getState().setActive('c1', 'pending')
    await useConsultationStore.getState().setStatus('active')
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    expect(JSON.parse(raw!).status).toBe('active')
  })
})

describe('clear', () => {
  it('resets all state', async () => {
    await useConsultationStore.getState().setActive('c1', 'active')
    useConsultationStore.getState().appendMessage(msg)
    await useConsultationStore.getState().clear()
    const { activeConsultationId, status, messages } = useConsultationStore.getState()
    expect(activeConsultationId).toBeNull()
    expect(status).toBeNull()
    expect(messages).toHaveLength(0)
  })

  it('removes entry from AsyncStorage', async () => {
    await useConsultationStore.getState().setActive('c1', 'active')
    await useConsultationStore.getState().clear()
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('hydrate', () => {
  it('restores state from AsyncStorage', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'c1', status: 'active' }))
    await useConsultationStore.getState().hydrate()
    const { activeConsultationId, status } = useConsultationStore.getState()
    expect(activeConsultationId).toBe('c1')
    expect(status).toBe('active')
  })

  it('does nothing when AsyncStorage is empty', async () => {
    await useConsultationStore.getState().hydrate()
    expect(useConsultationStore.getState().activeConsultationId).toBeNull()
  })
})
