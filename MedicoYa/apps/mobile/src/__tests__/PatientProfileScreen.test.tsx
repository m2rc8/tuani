import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}))

jest.mock('../store/authStore', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import PatientProfileScreen from '../screens/patient/PatientProfileScreen'

const mockGet = api.get as jest.Mock
const mockPut = api.put as jest.Mock
const mockAuthStore = useAuthStore as jest.Mock

const baseProfile = {
  name: 'María López',
  phone: '+50499887766',
  dob: '1990-05-15T00:00:00.000Z',
  allergies: 'Penicilina',
}

const mockStore = {
  language: 'es' as const,
  setLanguage: jest.fn(),
  logout: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthStore.mockImplementation((selector: any) => selector(mockStore))
  mockGet.mockResolvedValue({ data: baseProfile })
  mockPut.mockResolvedValue({ data: { ...baseProfile, name: 'Nueva' } })
})

describe('PatientProfileScreen', () => {
  it('loads and displays profile fields', async () => {
    const { getByTestId } = render(<PatientProfileScreen />)
    await waitFor(() => {
      expect(getByTestId('name-input').props.value).toBe('María López')
      expect(getByTestId('allergies-input').props.value).toBe('Penicilina')
    })
    expect(mockGet).toHaveBeenCalledWith('/api/patients/me')
  })

  it('calls PUT with updated data on save', async () => {
    const { getByTestId } = render(<PatientProfileScreen />)
    await waitFor(() => expect(getByTestId('name-input').props.value).toBe('María López'))
    fireEvent.changeText(getByTestId('name-input'), 'Ana Torres')
    fireEvent.press(getByTestId('save-btn'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/api/patients/me',
        expect.objectContaining({ name: 'Ana Torres' })
      )
    })
  })

  it('calls setLanguage when language toggle pressed', async () => {
    const { getByTestId } = render(<PatientProfileScreen />)
    await waitFor(() => expect(getByTestId('name-input')).toBeTruthy())
    fireEvent.press(getByTestId('lang-en'))
    expect(mockStore.setLanguage).toHaveBeenCalledWith('en')
  })

  it('calls logout when logout button pressed', async () => {
    const { getByTestId } = render(<PatientProfileScreen />)
    await waitFor(() => expect(getByTestId('logout-btn')).toBeTruthy())
    fireEvent.press(getByTestId('logout-btn'))
    expect(mockStore.logout).toHaveBeenCalled()
  })
})
