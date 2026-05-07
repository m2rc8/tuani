import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

jest.mock('../store/consultationStore', () => ({
  useConsultationStore: jest.fn(() => ({ clear: jest.fn().mockResolvedValue(undefined) })),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

jest.mock('react-qr-code', () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => {
    const { View, Text } = require('react-native')
    return <View testID="qr-code"><Text>{value}</Text></View>
  },
}))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}))

import api from '../lib/api'
const mockedApi = api as jest.Mocked<typeof api>

const navigation = { goBack: jest.fn() } as any

const CONS_ID = 'cons-1'
const route   = { params: { consultationId: CONS_ID } }

const baseDetail = {
  id: CONS_ID, patient_id: 'p-1', doctor_id: 'd-1',
  status: 'completed', symptoms_text: null, symptom_photo: null,
  diagnosis: 'Flu', diagnosis_code: null,
  created_at: '2026-05-06T00:00:00Z', completed_at: '2026-05-06T01:00:00Z',
  prescription: {
    id: 'rx-1', consultation_id: CONS_ID, qr_code: 'ABC123',
    medications: [{ name: 'Ibuprofen', dose: '400mg', frequency: 'TID' }],
    instructions: null, valid_until: '2026-06-05T00:00:00Z',
  },
  rating: null,
}

const consultation = {
  id: 'c1', patient_id: 'u1', doctor_id: 'd1', status: 'completed',
  symptoms_text: 'Dolor', symptom_photo: null, diagnosis: 'Gripe viral', diagnosis_code: null,
  created_at: '2026-05-05T00:00:00Z', completed_at: '2026-05-05T01:00:00Z',
  rating: null,
  prescription: {
    id: 'p1', consultation_id: 'c1', qr_code: 'XYZ789',
    medications: [
      { name: 'Paracetamol', dose: '500mg', frequency: 'cada 8h' },
      { name: 'Loratadina', dose: '10mg', frequency: 'cada 24h' },
    ],
    instructions: 'Reposa y toma líquidos',
    valid_until: '2026-06-05T00:00:00Z',
  },
}

const legacyRoute = { params: { consultationId: 'c1' } } as any

beforeEach(() => {
  jest.clearAllMocks()
})

describe('PrescriptionScreen — content', () => {
  beforeEach(() => {
    mockedApi.get.mockResolvedValue({ data: consultation })
  })

  it('shows diagnosis', async () => {
    const { findByText } = render(<PrescriptionScreen navigation={navigation} route={legacyRoute} />)
    expect(await findByText('Gripe viral')).toBeTruthy()
  })

  it('shows all medications', async () => {
    const { findByText } = render(<PrescriptionScreen navigation={navigation} route={legacyRoute} />)
    expect(await findByText('Paracetamol — 500mg — cada 8h')).toBeTruthy()
    expect(await findByText('Loratadina — 10mg — cada 24h')).toBeTruthy()
  })

  it('renders QR code', async () => {
    const { findByTestId } = render(<PrescriptionScreen navigation={navigation} route={legacyRoute} />)
    expect(await findByTestId('qr-code')).toBeTruthy()
  })

  it('shows instructions', async () => {
    const { findByText } = render(<PrescriptionScreen navigation={navigation} route={legacyRoute} />)
    expect(await findByText('Reposa y toma líquidos')).toBeTruthy()
  })
})

describe('PrescriptionScreen', () => {
  it('shows star picker when consultation is unrated', async () => {
    mockedApi.get.mockResolvedValue({ data: { ...baseDetail, rating: null } })
    const { getByTestId } = render(<PrescriptionScreen route={route} />)
    await waitFor(() => expect(getByTestId('star-1')).toBeTruthy())
    expect(getByTestId('rating-submit')).toBeTruthy()
  })

  it('submits rating and shows thanks message', async () => {
    mockedApi.get.mockResolvedValue({ data: { ...baseDetail, rating: null } })
    mockedApi.post.mockResolvedValue({})
    const { getByTestId, getByText } = render(<PrescriptionScreen route={route} />)
    await waitFor(() => getByTestId('star-4'))
    fireEvent.press(getByTestId('star-4'))
    fireEvent.press(getByTestId('rating-submit'))
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/api/ratings', {
        consultation_id: CONS_ID, stars: 4, comment: '',
      })
    )
    await waitFor(() => getByText('consultation.rate_thanks'))
  })

  it('shows read-only thanks when already rated', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ...baseDetail,
        rating: { id: 'r-1', stars: 3, comment: null, created_at: '2026-05-06T01:30:00Z' },
      },
    })
    const { queryByTestId, getByText } = render(<PrescriptionScreen route={route} />)
    await waitFor(() => getByText('consultation.rate_thanks'))
    expect(queryByTestId('rating-submit')).toBeNull()
  })
})
