import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import OtpScreen from '../screens/auth/OtpScreen'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

jest.mock('../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
const mockApi = api as jest.Mocked<typeof api>

const mockGoBack = jest.fn()
const navigation = { goBack: mockGoBack } as any
const route = { params: { phone: '+50499000000' } } as any

beforeEach(async () => {
  jest.clearAllMocks()
  useAuthStore.setState({ token: null, userId: null, role: null, language: 'es' })
})

describe('OtpScreen', () => {
  it('verify button is disabled when code has fewer than 6 digits', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), '123')
    expect(getByTestId('verify-btn').props.accessibilityState?.disabled).toBe(true)
  })

  it('verify button is enabled when code is exactly 6 digits', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), '123456')
    expect(getByTestId('verify-btn').props.accessibilityState?.disabled).toBeFalsy()
  })

  it('strips non-digit characters from input', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), 'abc123def')
    expect(getByTestId('code-input').props.value).toBe('123')
  })

  it('truncates input to 6 digits', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), '1234567890')
    expect(getByTestId('code-input').props.value).toBe('123456')
  })

  it('calls authStore.login with token and user on success', async () => {
    mockApi.post.mockResolvedValueOnce({
      data: {
        token: 'jwt-tok',
        user: { id: 'u1', role: 'patient', preferred_language: 'es' },
      },
    })
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('code-input'), '123456')
    fireEvent.press(getByTestId('verify-btn'))
    await waitFor(() => expect(useAuthStore.getState().token).toBe('jwt-tok'))
  })

  it('shows error message on API failure', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('bad code'))
    const { getByTestId, findByText } = render(
      <OtpScreen navigation={navigation} route={route} />,
    )
    fireEvent.changeText(getByTestId('code-input'), '123456')
    fireEvent.press(getByTestId('verify-btn'))
    await findByText('auth.error_verify')
  })

  it('calls navigation.goBack when change phone pressed', () => {
    const { getByTestId } = render(<OtpScreen navigation={navigation} route={route} />)
    fireEvent.press(getByTestId('back-btn'))
    expect(mockGoBack).toHaveBeenCalled()
  })
})
