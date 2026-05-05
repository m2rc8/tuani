import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import LoginScreen from '../screens/auth/LoginScreen'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import api from '../lib/api'
const mockApi = api as jest.Mocked<typeof api>

const mockNavigate = jest.fn()
const navigation = { navigate: mockNavigate } as any
const route = {} as any

beforeEach(() => jest.clearAllMocks())

describe('LoginScreen', () => {
  it('send button is disabled when phone is empty', () => {
    const { getByTestId } = render(<LoginScreen navigation={navigation} route={route} />)
    expect(getByTestId('send-btn').props.accessibilityState?.disabled).toBe(true)
  })

  it('send button is enabled when phone has value', () => {
    const { getByTestId } = render(<LoginScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('phone-input'), '+50499000000')
    expect(getByTestId('send-btn').props.accessibilityState?.disabled).toBeFalsy()
  })

  it('navigates to Otp with phone on success', async () => {
    mockApi.post.mockResolvedValueOnce({ data: {} })
    const { getByTestId } = render(<LoginScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('phone-input'), '+50499000000')
    fireEvent.press(getByTestId('send-btn'))
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('Otp', { phone: '+50499000000' }),
    )
  })

  it('shows error message on API failure', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('network'))
    const { getByTestId, findByText } = render(
      <LoginScreen navigation={navigation} route={route} />,
    )
    fireEvent.changeText(getByTestId('phone-input'), '+50499000000')
    fireEvent.press(getByTestId('send-btn'))
    await findByText('auth.error_send')
  })
})
