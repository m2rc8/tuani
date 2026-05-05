import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}))

jest.mock('../lib/socket', () => ({
  socketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connected: false,
  },
}))

jest.mock('../store/consultationStore', () => ({
  useConsultationStore: jest.fn(),
}))

jest.mock('../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({ token: 'tok', userId: 'u1' })),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import api from '../lib/api'
import { socketService } from '../lib/socket'
import { useConsultationStore } from '../store/consultationStore'
import WaitingScreen from '../screens/patient/WaitingScreen'

const mockApi = api as jest.Mocked<typeof api>
const mockSocket = socketService as jest.Mocked<typeof socketService>
const mockUseConsultationStore = useConsultationStore as jest.MockedFunction<typeof useConsultationStore>

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const navigation = { navigate: mockNavigate, replace: mockReplace, goBack: jest.fn() } as any

const defaultStore = {
  activeConsultationId: 'c1',
  status: 'pending' as const,
  messages: [],
  setActive: jest.fn(),
  appendMessage: jest.fn(),
  setStatus: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  hydrate: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseConsultationStore.mockReturnValue(defaultStore as any)
  mockApi.get.mockResolvedValue({
    data: { id: 'c1', symptoms_text: 'Me duele la cabeza', status: 'pending' },
  })
  mockApi.put.mockResolvedValue({ data: {} })
})

const route = { params: { consultationId: 'c1' } } as any

describe('WaitingScreen', () => {
  it('renders symptoms text', async () => {
    const { findByText } = render(<WaitingScreen navigation={navigation} route={route} />)
    expect(await findByText('Me duele la cabeza')).toBeTruthy()
  })

  it('joins socket room on mount', async () => {
    render(<WaitingScreen navigation={navigation} route={route} />)
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('join_consultation', { consultation_id: 'c1' })
    })
  })

  it('cancel calls PUT cancel, clears store, goes back', async () => {
    const clear = jest.fn().mockResolvedValue(undefined)
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, clear } as any)
    const { getByTestId } = render(<WaitingScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.press(getByTestId('cancel-btn'))
    await waitFor(() => {
      expect(mockApi.put).toHaveBeenCalledWith('/api/consultations/c1/cancel')
      expect(clear).toHaveBeenCalled()
      expect(navigation.goBack).toHaveBeenCalled()
    })
  })

  it('navigates to ConsultationScreen on consultation_updated with active status', async () => {
    let capturedHandler: ((data: any) => void) | undefined
    mockSocket.on.mockImplementation((event, cb) => {
      if (event === 'consultation_updated') capturedHandler = cb
    })

    const setStatus = jest.fn().mockResolvedValue(undefined)
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, setStatus } as any)

    render(<WaitingScreen navigation={navigation} route={route} />)
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith('consultation_updated', expect.any(Function)))

    capturedHandler!({ id: 'c1', status: 'active' })
    await waitFor(() => {
      expect(setStatus).toHaveBeenCalledWith('active')
      expect(mockReplace).toHaveBeenCalledWith('ConsultationScreen', { consultationId: 'c1' })
    })
  })
})
