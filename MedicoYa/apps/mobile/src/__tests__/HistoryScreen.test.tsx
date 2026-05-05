import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import api from '../lib/api'
import HistoryScreen from '../screens/patient/HistoryScreen'

const mockApi = api as jest.Mocked<typeof api>
const mockNavigate = jest.fn()
const navigation = { navigate: mockNavigate } as any
const route = {} as any

const consultations = [
  {
    id: 'c1', status: 'completed', diagnosis: 'Gripe viral',
    created_at: '2026-05-05T00:00:00Z', prescription: { id: 'p1' },
  },
  {
    id: 'c2', status: 'active', diagnosis: null,
    created_at: '2026-05-04T00:00:00Z', prescription: null,
  },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockApi.get.mockResolvedValue({ data: consultations })
})

describe('HistoryScreen', () => {
  it('shows empty state when no consultations', async () => {
    mockApi.get.mockResolvedValue({ data: [] })
    const { findByText } = render(<HistoryScreen navigation={navigation} route={route} />)
    expect(await findByText('history.empty')).toBeTruthy()
  })

  it('shows consultation items', async () => {
    const { findByText } = render(<HistoryScreen navigation={navigation} route={route} />)
    expect(await findByText('Gripe viral')).toBeTruthy()
    expect(await findByText('history.status.completed')).toBeTruthy()
    expect(await findByText('history.status.active')).toBeTruthy()
  })

  it('navigates to PrescriptionScreen when tapping completed consultation', async () => {
    const { findByTestId } = render(<HistoryScreen navigation={navigation} route={route} />)
    fireEvent.press(await findByTestId('consultation-c1'))
    expect(mockNavigate).toHaveBeenCalledWith('PrescriptionScreen', { consultationId: 'c1' })
  })

  it('navigates to ConsultationScreen when tapping active consultation', async () => {
    const { findByTestId } = render(<HistoryScreen navigation={navigation} route={route} />)
    fireEvent.press(await findByTestId('consultation-c2'))
    expect(mockNavigate).toHaveBeenCalledWith('ConsultationScreen', { consultationId: 'c2' })
  })
})
