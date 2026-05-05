import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
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

import api from '../lib/api'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'

const mockApi = api as jest.Mocked<typeof api>

const navigation = { goBack: jest.fn() } as any
const route = { params: { consultationId: 'c1' } } as any

const consultation = {
  id: 'c1', patient_id: 'u1', doctor_id: 'd1', status: 'completed',
  symptoms_text: 'Dolor', diagnosis: 'Gripe viral', diagnosis_code: null,
  created_at: '2026-05-05T00:00:00Z', completed_at: '2026-05-05T01:00:00Z',
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

beforeEach(() => {
  jest.clearAllMocks()
  mockApi.get.mockResolvedValue({ data: consultation })
})

describe('PrescriptionScreen', () => {
  it('shows diagnosis', async () => {
    const { findByText } = render(<PrescriptionScreen navigation={navigation} route={route} />)
    expect(await findByText('Gripe viral')).toBeTruthy()
  })

  it('shows all medications', async () => {
    const { findByText } = render(<PrescriptionScreen navigation={navigation} route={route} />)
    expect(await findByText('Paracetamol — 500mg — cada 8h')).toBeTruthy()
    expect(await findByText('Loratadina — 10mg — cada 24h')).toBeTruthy()
  })

  it('renders QR code', async () => {
    const { findByTestId } = render(<PrescriptionScreen navigation={navigation} route={route} />)
    expect(await findByTestId('qr-code')).toBeTruthy()
  })

  it('shows instructions', async () => {
    const { findByText } = render(<PrescriptionScreen navigation={navigation} route={route} />)
    expect(await findByText('Reposa y toma líquidos')).toBeTruthy()
  })
})
