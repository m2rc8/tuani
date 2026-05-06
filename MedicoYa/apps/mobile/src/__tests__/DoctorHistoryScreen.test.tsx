import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import DoctorHistoryScreen from '../screens/doctor/HistoryScreen'
import api from '../lib/api'

jest.mock('../lib/api', () => ({ __esModule: true, default: { get: jest.fn() } }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const mockGet = api.get as jest.Mock
const navigation = { navigate: jest.fn() }

const completedItem = {
  id: 'c-1', status: 'completed', diagnosis: 'Pharyngitis',
  created_at: new Date().toISOString(), prescription: { id: 'rx-1' },
}
const activeItem = {
  id: 'c-2', status: 'active', diagnosis: null,
  created_at: new Date().toISOString(), prescription: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ data: [completedItem, activeItem] })
})

describe('DoctorHistoryScreen', () => {
  it('renders empty state when no consultations', async () => {
    mockGet.mockResolvedValue({ data: [] })
    const { getByText } = render(<DoctorHistoryScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByText('history.empty')).toBeTruthy() })
  })

  it('renders consultation cards', async () => {
    const { getByTestId } = render(<DoctorHistoryScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByTestId('consultation-c-1')).toBeTruthy()
      expect(getByTestId('consultation-c-2')).toBeTruthy()
    })
  })

  it('tapping completed consultation navigates to PrescriptionScreen', async () => {
    const { getByTestId } = render(<DoctorHistoryScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('consultation-c-1')).toBeTruthy() })
    fireEvent.press(getByTestId('consultation-c-1'))
    expect(navigation.navigate).toHaveBeenCalledWith('PrescriptionScreen', { consultationId: 'c-1' })
  })

  it('tapping active consultation navigates to DoctorConsultationScreen', async () => {
    const { getByTestId } = render(<DoctorHistoryScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('consultation-c-2')).toBeTruthy() })
    fireEvent.press(getByTestId('consultation-c-2'))
    expect(navigation.navigate).toHaveBeenCalledWith('DoctorConsultationScreen', { consultationId: 'c-2' })
  })
})
