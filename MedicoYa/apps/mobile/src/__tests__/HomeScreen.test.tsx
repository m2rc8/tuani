import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

jest.mock('../store/consultationStore', () => ({
  useConsultationStore: jest.fn(),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: any) => opts ? `${k}:${JSON.stringify(opts)}` : k }),
}))

jest.mock('expo-image-picker', () => ({
  launchCameraAsync:       jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}))

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}))

import api from '../lib/api'
import { useConsultationStore } from '../store/consultationStore'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import HomeScreen from '../screens/patient/HomeScreen'

const mockApi                  = api as jest.Mocked<typeof api>
const mockUseConsultationStore = useConsultationStore as jest.MockedFunction<typeof useConsultationStore>
const mockImagePicker          = ImagePicker as jest.Mocked<typeof ImagePicker>
const mockManipulator          = ImageManipulator as jest.Mocked<typeof ImageManipulator>

const mockNavigate = jest.fn()
const navigation   = { navigate: mockNavigate } as any
const route        = {} as any

const defaultStore = {
  activeConsultationId: null,
  status: null,
  messages: [],
  setActive: jest.fn(),
  appendMessage: jest.fn(),
  setStatus: jest.fn(),
  clear: jest.fn(),
  hydrate: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseConsultationStore.mockReturnValue(defaultStore as any)
  mockApi.get.mockResolvedValue({ data: [] })
  mockManipulator.manipulateAsync.mockResolvedValue({ uri: 'file://compressed.jpg' } as any)
})

describe('HomeScreen', () => {
  it('submit button disabled when textarea is empty', async () => {
    const { getByTestId } = render(<HomeScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    expect(getByTestId('submit-btn').props.accessibilityState?.disabled).toBe(true)
  })

  it('submit button disabled when no doctors available', async () => {
    mockApi.get.mockResolvedValue({ data: [] })
    const { getByTestId } = render(<HomeScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.changeText(getByTestId('symptoms-input'), 'Me duele la cabeza')
    expect(getByTestId('submit-btn').props.accessibilityState?.disabled).toBe(true)
  })

  it('submit button enabled when text entered and doctors available', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'd1', user: { name: 'Dr. A' } }] })
    const { getByTestId } = render(<HomeScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.changeText(getByTestId('symptoms-input'), 'Me duele la cabeza')
    expect(getByTestId('submit-btn').props.accessibilityState?.disabled).toBeFalsy()
  })

  it('on submit success: calls setActive and navigates to WaitingScreen', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'd1', user: { name: 'Dr. A' } }] })
    mockApi.post.mockResolvedValue({ data: { id: 'c123' } })
    const setActive = jest.fn().mockResolvedValue(undefined)
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, setActive } as any)

    const { getByTestId } = render(<HomeScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.changeText(getByTestId('symptoms-input'), 'Me duele la cabeza')
    fireEvent.press(getByTestId('submit-btn'))

    await waitFor(() => {
      expect(setActive).toHaveBeenCalledWith('c123', 'pending')
      expect(mockNavigate).toHaveBeenCalledWith('WaitingScreen', { consultationId: 'c123' })
    })
  })

  it('redirects to WaitingScreen on mount when active consultation is pending', async () => {
    mockUseConsultationStore.mockReturnValue({
      ...defaultStore,
      activeConsultationId: 'c99',
      status: 'pending',
    } as any)
    render(<HomeScreen navigation={navigation} route={route} />)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('WaitingScreen', { consultationId: 'c99' })
    })
  })

  it('redirects to ConsultationScreen on mount when active consultation is active', async () => {
    mockUseConsultationStore.mockReturnValue({
      ...defaultStore,
      activeConsultationId: 'c99',
      status: 'active',
    } as any)
    render(<HomeScreen navigation={navigation} route={route} />)
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('ConsultationScreen', { consultationId: 'c99' })
    })
  })

  it('shows attach-photo-btn by default', async () => {
    const { getByTestId } = render(<HomeScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    expect(getByTestId('attach-photo-btn')).toBeTruthy()
  })

  it('remove-photo-btn absent initially (no photo selected)', async () => {
    const { queryByTestId } = render(<HomeScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    expect(queryByTestId('remove-photo-btn')).toBeNull()
    expect(queryByTestId('photo-thumbnail')).toBeNull()
  })
})
