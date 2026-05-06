import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import QueueScreen from '../screens/doctor/QueueScreen'
import api from '../lib/api'
import { socketService } from '../lib/socket'
import { useAuthStore } from '../store/authStore'

jest.mock('../lib/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }))
jest.mock('../lib/socket', () => ({
  socketService: { connect: jest.fn(), emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
jest.mock('../store/authStore', () => ({ useAuthStore: jest.fn() }))

const mockGet = api.get as jest.Mock
const mockPut = api.put as jest.Mock
const mockAuthStore = useAuthStore as jest.Mock

const queueItem = {
  id: 'c-1',
  status: 'pending',
  symptoms_text: 'headache for 3 days',
  created_at: new Date().toISOString(),
  patient: { user: { phone: '+50412345678' } },
}

const navigation = { navigate: jest.fn(), goBack: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthStore.mockImplementation((selector: any) => selector({ token: 'tok' }))
  mockGet.mockResolvedValue({ data: [queueItem] })
})

describe('QueueScreen', () => {
  it('renders pending consultation card', async () => {
    const { getByTestId } = render(<QueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByTestId('queue-item-c-1')).toBeTruthy()
    })
  })

  it('renders empty state when queue is empty', async () => {
    mockGet.mockResolvedValue({ data: [] })
    const { getByText } = render(<QueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByText('queue.empty')).toBeTruthy()
    })
  })

  it('accept button calls PUT accept and navigates to DoctorConsultationScreen', async () => {
    mockPut.mockResolvedValue({})
    const { getByTestId } = render(<QueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('queue-item-c-1')).toBeTruthy() })
    fireEvent.press(getByTestId('accept-c-1'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/consultations/c-1/accept')
      expect(navigation.navigate).toHaveBeenCalledWith('DoctorConsultationScreen', { consultationId: 'c-1' })
    })
  })

  it('reject button calls PUT reject and removes card from list', async () => {
    mockPut.mockResolvedValue({})
    const { getByTestId, queryByTestId } = render(<QueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('queue-item-c-1')).toBeTruthy() })
    fireEvent.press(getByTestId('reject-c-1'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/consultations/c-1/reject')
      expect(queryByTestId('queue-item-c-1')).toBeNull()
    })
  })
})
