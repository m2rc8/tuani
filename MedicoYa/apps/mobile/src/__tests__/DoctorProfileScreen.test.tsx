import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import DoctorProfileScreen from '../screens/doctor/DoctorProfileScreen'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'

jest.mock('../lib/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
jest.mock('../store/authStore', () => ({ useAuthStore: jest.fn() }))
jest.mock('expo-secure-store', () => ({ deleteItemAsync: jest.fn() }))
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}))

const mockGet = api.get as jest.Mock
const mockPut = api.put as jest.Mock
const mockAuthStore = useAuthStore as jest.Mock
const mockStore = { language: 'es', setLanguage: jest.fn(), logout: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthStore.mockImplementation((selector: any) => selector(mockStore))
})

describe('DoctorProfileScreen', () => {
  it('renders toggle off when available=false', async () => {
    mockGet.mockResolvedValue({ data: { available: false } })
    const { getByTestId } = render(<DoctorProfileScreen />)
    await waitFor(() => {
      expect(getByTestId('availability-switch').props.value).toBe(false)
    })
  })

  it('renders toggle on when available=true', async () => {
    mockGet.mockResolvedValue({ data: { available: true } })
    const { getByTestId } = render(<DoctorProfileScreen />)
    await waitFor(() => {
      expect(getByTestId('availability-switch').props.value).toBe(true)
    })
  })

  it('toggling calls PUT with flipped value', async () => {
    mockGet.mockResolvedValue({ data: { available: false } })
    mockPut.mockResolvedValue({})
    const { getByTestId } = render(<DoctorProfileScreen />)
    await waitFor(() => { expect(getByTestId('availability-switch')).toBeTruthy() })
    fireEvent(getByTestId('availability-switch'), 'valueChange', true)
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/doctors/availability', { available: true })
    })
  })

  it('PUT failure reverts switch to previous value', async () => {
    mockGet.mockResolvedValue({ data: { available: true } })
    mockPut.mockRejectedValue(new Error('network'))
    const { getByTestId } = render(<DoctorProfileScreen />)
    await waitFor(() => {
      expect(getByTestId('availability-switch').props.value).toBe(true)
    })
    fireEvent(getByTestId('availability-switch'), 'valueChange', false)
    await waitFor(() => {
      expect(getByTestId('availability-switch').props.value).toBe(true)
    })
  })
})
