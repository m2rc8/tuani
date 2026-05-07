import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import BrigadeQueueScreen from '../screens/doctor/BrigadeQueueScreen'
import api from '../lib/api'
import { useBrigadeStore } from '../store/brigadeStore'
import NetInfo from '@react-native-community/netinfo'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: any) => opts ? `${k}:${JSON.stringify(opts)}` : k }) }))
jest.mock('../store/brigadeStore', () => {
  const actual = jest.requireActual('../store/brigadeStore')
  return actual
})

const mockPost = api.post as jest.Mock
const mockNetInfoAdd = NetInfo.addEventListener as jest.Mock

const navigation = { navigate: jest.fn(), goBack: jest.fn() }

const activeBrigade = { id: 'b1', name: 'Brigada Norte', community: 'X', status: 'active' as const }

const pendingItem = {
  local_id: 'loc-1',
  patient_phone: '+50499111111',
  patient_name: 'María',
  medications: [],
  created_at: new Date().toISOString(),
  synced: false,
}

const syncedItem = {
  ...pendingItem,
  local_id: 'loc-2',
  patient_name: 'Juan',
  synced: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  useBrigadeStore.setState({
    activeBrigade,
    brigades: [],
    patientCache: [],
    offlineQueue: [pendingItem, syncedItem],
    syncState: 'idle',
    lastSyncedAt: null,
  })
  mockNetInfoAdd.mockImplementation(() => jest.fn())
})

describe('BrigadeQueueScreen', () => {
  it('renders pending and synced counts', async () => {
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByTestId('pending-count')).toBeTruthy()
      expect(getByTestId('synced-count')).toBeTruthy()
    })
  })

  it('renders consultation items from offlineQueue', async () => {
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByTestId('queue-item-loc-1')).toBeTruthy()
      expect(getByTestId('queue-item-loc-2')).toBeTruthy()
    })
  })

  it('sync button calls POST /api/sync/consultations with pending items', async () => {
    mockPost.mockResolvedValue({ data: { accepted: ['loc-1'], rejected: [] } })
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await act(async () => { fireEvent.press(getByTestId('sync-btn')) })
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/sync/consultations', expect.objectContaining({
        brigade_id: 'b1',
        consultations: expect.arrayContaining([
          expect.objectContaining({ local_id: 'loc-1' }),
        ]),
      }))
    })
  })

  it('marks items as synced after successful sync', async () => {
    mockPost.mockResolvedValue({ data: { accepted: ['loc-1'], rejected: [] } })
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await act(async () => { fireEvent.press(getByTestId('sync-btn')) })
    await waitFor(() => {
      const queue = useBrigadeStore.getState().offlineQueue
      expect(queue.find(c => c.local_id === 'loc-1')?.synced).toBe(true)
    })
  })

  it('NetInfo reconnect triggers auto-sync when pending items exist', async () => {
    let capturedListener: ((state: any) => void) | null = null
    mockNetInfoAdd.mockImplementation((cb: any) => {
      capturedListener = cb
      return jest.fn()
    })
    mockPost.mockResolvedValue({ data: { accepted: ['loc-1'], rejected: [] } })
    render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await act(async () => { capturedListener?.({ isConnected: true }) })
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/sync/consultations', expect.any(Object))
    })
  })

  it('leave brigade button clears activeBrigade and goes back', async () => {
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await act(async () => { fireEvent.press(getByTestId('leave-btn')) })
    await waitFor(() => {
      expect(useBrigadeStore.getState().activeBrigade).toBeNull()
      expect(navigation.goBack).toHaveBeenCalled()
    })
  })

  it('new consultation button navigates to BrigadeConsultationScreen', async () => {
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    fireEvent.press(getByTestId('new-consultation-btn'))
    expect(navigation.navigate).toHaveBeenCalledWith('BrigadeConsultationScreen', {})
  })
})
