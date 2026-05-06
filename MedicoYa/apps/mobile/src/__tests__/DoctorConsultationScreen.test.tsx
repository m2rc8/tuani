import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import DoctorConsultationScreen from '../screens/doctor/DoctorConsultationScreen'
import api from '../lib/api'
import { socketService } from '../lib/socket'
import { useAuthStore } from '../store/authStore'
import { useConsultationStore } from '../store/consultationStore'

jest.mock('../lib/api', () => ({ __esModule: true, default: { get: jest.fn() } }))
jest.mock('../lib/socket', () => ({
  socketService: { connect: jest.fn(), emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
jest.mock('../store/authStore', () => ({ useAuthStore: jest.fn() }))
jest.mock('../store/consultationStore', () => ({ useConsultationStore: jest.fn() }))

const mockGet = api.get as jest.Mock
const mockAuthStore = useAuthStore as jest.Mock
const mockConsultationStore = useConsultationStore as jest.Mock

const navigation = { navigate: jest.fn(), goBack: jest.fn() }
const route = { params: { consultationId: 'c-1' } }

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthStore.mockImplementation((selector: any) => selector({ token: 'tok', userId: 'doc-1' }))
  mockConsultationStore.mockReturnValue({
    messages: [], status: 'active', appendMessage: jest.fn(), setStatus: jest.fn(),
  })
  mockGet.mockResolvedValue({ data: { status: 'active', messages: [], prescription: null } })
})

describe('DoctorConsultationScreen', () => {
  it('fetches consultation on mount', async () => {
    render(<DoctorConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/consultations/c-1')
    })
  })

  it('sends message via socket', async () => {
    const { getByTestId } = render(<DoctorConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalled() })
    fireEvent.changeText(getByTestId('chat-input'), 'hello patient')
    fireEvent.press(getByTestId('send-btn'))
    expect(socketService.emit).toHaveBeenCalledWith('send_message', expect.objectContaining({
      consultation_id: 'c-1',
      content: 'hello patient',
    }))
  })

  it('Completar button navigates to WriteRxScreen', async () => {
    const { getByTestId } = render(<DoctorConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalled() })
    fireEvent.press(getByTestId('complete-btn'))
    expect(navigation.navigate).toHaveBeenCalledWith('WriteRxScreen', { consultationId: 'c-1' })
  })

  it('input disabled and complete button hidden when status is completed', async () => {
    mockConsultationStore.mockReturnValue({
      messages: [], status: 'completed', appendMessage: jest.fn(), setStatus: jest.fn(),
    })
    const { getByTestId, queryByTestId } = render(<DoctorConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalled() })
    expect(getByTestId('chat-input').props.editable).toBe(false)
    expect(queryByTestId('complete-btn')).toBeNull()
  })
})
