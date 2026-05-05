import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

jest.mock('../lib/socket', () => ({
  socketService: {
    connect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connected: true,
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
import ConsultationScreen from '../screens/patient/ConsultationScreen'

const mockApi = api as jest.Mocked<typeof api>
const mockSocket = socketService as jest.Mocked<typeof socketService>
const mockUseConsultationStore = useConsultationStore as jest.MockedFunction<typeof useConsultationStore>

const mockNavigate = jest.fn()
const navigation = { navigate: mockNavigate, goBack: jest.fn() } as any
const route = { params: { consultationId: 'c1' } } as any

const baseConsultation = {
  id: 'c1', patient_id: 'u1', doctor_id: 'd1', status: 'active' as const,
  symptoms_text: 'Dolor de cabeza', symptom_photo: null,
  diagnosis: null, diagnosis_code: null, created_at: '2026-05-05T00:00:00Z',
  completed_at: null, prescription: null,
}

const defaultStore = {
  activeConsultationId: 'c1',
  status: 'active' as const,
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
  mockApi.get.mockResolvedValue({ data: { ...baseConsultation, messages: [] } })
})

describe('ConsultationScreen', () => {
  it('loads and displays existing messages', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        ...baseConsultation,
        messages: [{ id: 'm1', sender_id: 'd1', content: 'Hola', msg_type: 'text', created_at: '2026-05-05T00:00:00Z' }],
      },
    })
    const appendMessage = jest.fn()
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, appendMessage } as any)
    render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {
      expect(appendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'Hola' }))
    })
  })

  it('sends message via socket on press', async () => {
    const { getByTestId } = render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.changeText(getByTestId('chat-input'), 'Tengo fiebre')
    fireEvent.press(getByTestId('send-btn'))
    expect(mockSocket.emit).toHaveBeenCalledWith('send_message', {
      consultation_id: 'c1',
      content: 'Tengo fiebre',
      msg_type: 'text',
    })
  })

  it('clears input after sending', async () => {
    const { getByTestId } = render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.changeText(getByTestId('chat-input'), 'Tengo fiebre')
    fireEvent.press(getByTestId('send-btn'))
    expect(getByTestId('chat-input').props.value).toBe('')
  })

  it('disables input when consultation is completed', async () => {
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, status: 'completed' } as any)
    const { getByTestId } = render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    expect(getByTestId('chat-input').props.editable).toBe(false)
  })

  it('shows prescription card when status_updated to completed', async () => {
    let capturedHandler: ((data: any) => void) | undefined
    mockSocket.on.mockImplementation((event, cb) => {
      if (event === 'consultation_updated') capturedHandler = cb
    })
    const completedConsultation = {
      ...baseConsultation, status: 'completed' as const,
      diagnosis: 'Gripe viral',
      prescription: {
        id: 'p1', consultation_id: 'c1', qr_code: 'ABC123',
        medications: [{ name: 'Paracetamol', dose: '500mg', frequency: 'c/8h' }],
        instructions: null, valid_until: '2026-06-05T00:00:00Z',
      },
    }
    mockApi.get
      .mockResolvedValueOnce({ data: { ...baseConsultation, messages: [] } })
      .mockResolvedValueOnce({ data: completedConsultation })

    const setStatus = jest.fn().mockResolvedValue(undefined)
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, setStatus } as any)

    const { findByTestId } = render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalled())

    capturedHandler!({ id: 'c1', status: 'completed' })
    expect(await findByTestId('prescription-card')).toBeTruthy()
  })
})
