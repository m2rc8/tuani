import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import BrigadeHomeScreen from '../screens/doctor/BrigadeHomeScreen'
import api from '../lib/api'
import { useBrigadeStore } from '../store/brigadeStore'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
jest.mock('../store/brigadeStore', () => {
  const actual = jest.requireActual('../store/brigadeStore')
  return actual
})

const mockGet = api.get as jest.Mock
const mockPost = api.post as jest.Mock

const navigation = { navigate: jest.fn(), goBack: jest.fn() }

const brigade = { id: 'b1', name: 'Brigada Norte', community: 'Comunidad X', status: 'active', joined_at: '2026-05-06T00:00:00Z' }
const seedResponse = {
  brigade: { id: 'b1', name: 'Brigada Norte', community: 'Comunidad X', status: 'active' },
  doctors: [{ id: 'd1', name: 'Dr. Juan' }],
  patients: [{ phone: '+50499111111', name: 'María' }],
}

beforeEach(() => {
  jest.clearAllMocks()
  useBrigadeStore.setState({ activeBrigade: null, brigades: [], patientCache: [], offlineQueue: [], syncState: 'idle', lastSyncedAt: null })
  mockGet.mockResolvedValue({ data: [brigade] })
})

describe('BrigadeHomeScreen', () => {
  it('renders brigade list from API on mount', async () => {
    const { getByText } = render(<BrigadeHomeScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByText('Brigada Norte')).toBeTruthy()
    })
    expect(mockGet).toHaveBeenCalledWith('/api/brigades')
  })

  it('Entrar button seeds brigade and navigates to BrigadeQueueScreen', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [brigade] })
      .mockResolvedValueOnce({ data: seedResponse })
    const { getByTestId } = render(<BrigadeHomeScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('enter-b1')).toBeTruthy() })
    await act(async () => { fireEvent.press(getByTestId('enter-b1')) })
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/sync/brigade/b1')
      expect(navigation.navigate).toHaveBeenCalledWith('BrigadeQueueScreen')
    })
  })

  it('join code search calls by-code endpoint and shows preview', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { id: 'b2', name: 'Brigada Sur', community: 'Sur' } })
    const { getByTestId, getByText } = render(<BrigadeHomeScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalledWith('/api/brigades') })
    fireEvent.changeText(getByTestId('join-code-input'), 'XYZ999')
    await act(async () => { fireEvent.press(getByTestId('search-btn')) })
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/brigades/by-code/XYZ999')
      expect(getByText('Brigada Sur')).toBeTruthy()
    })
  })

  it('confirm join POSTs to join endpoint then seeds and navigates', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { id: 'b2', name: 'Brigada Sur', community: 'Sur' } })
      .mockResolvedValueOnce({ data: seedResponse })
    mockPost.mockResolvedValue({})
    const { getByTestId } = render(<BrigadeHomeScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalledWith('/api/brigades') })
    fireEvent.changeText(getByTestId('join-code-input'), 'XYZ999')
    await act(async () => { fireEvent.press(getByTestId('search-btn')) })
    await waitFor(() => { expect(getByTestId('confirm-join-btn')).toBeTruthy() })
    await act(async () => { fireEvent.press(getByTestId('confirm-join-btn')) })
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/brigades/b2/join', { join_code: 'XYZ999' })
      expect(navigation.navigate).toHaveBeenCalledWith('BrigadeQueueScreen')
    })
  })
})
