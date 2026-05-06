import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import WriteRxScreen from '../screens/doctor/WriteRxScreen'
import api from '../lib/api'

jest.mock('../lib/api', () => ({ __esModule: true, default: { put: jest.fn() } }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const mockPut = api.put as jest.Mock
const navigation = { navigate: jest.fn(), goBack: jest.fn() }
const route = { params: { consultationId: 'c-1' } }

beforeEach(() => {
  jest.clearAllMocks()
})

describe('WriteRxScreen', () => {
  it('submit button disabled when diagnosis is empty', () => {
    const { getByTestId } = render(<WriteRxScreen navigation={navigation} route={route} />)
    expect(getByTestId('submit-btn').props.accessibilityState.disabled).toBe(true)
  })

  it('submit button enabled when diagnosis and medication name are filled', async () => {
    const { getByTestId } = render(<WriteRxScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('diagnosis-input'), 'Viral pharyngitis')
    fireEvent.changeText(getByTestId('med-name-0'), 'Ibuprofen')
    expect(getByTestId('submit-btn').props.accessibilityState.disabled).toBe(false)
  })

  it('calls PUT complete with correct payload and navigates back on success', async () => {
    mockPut.mockResolvedValue({})
    const { getByTestId } = render(<WriteRxScreen navigation={navigation} route={route} />)
    fireEvent.changeText(getByTestId('diagnosis-input'), 'Viral pharyngitis')
    fireEvent.changeText(getByTestId('med-name-0'), 'Ibuprofen')
    fireEvent.changeText(getByTestId('med-dose-0'), '400mg')
    fireEvent.changeText(getByTestId('med-freq-0'), 'Every 8 hours')
    fireEvent.press(getByTestId('submit-btn'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/consultations/c-1/complete', expect.objectContaining({
        diagnosis: 'Viral pharyngitis',
        medications: [{ name: 'Ibuprofen', dose: '400mg', frequency: 'Every 8 hours' }],
      }))
      expect(navigation.goBack).toHaveBeenCalled()
    })
  })

  it('add medication button appends a new medication row', () => {
    const { getByTestId, getAllByTestId } = render(<WriteRxScreen navigation={navigation} route={route} />)
    fireEvent.press(getByTestId('add-medication-btn'))
    expect(getAllByTestId(/^med-name-/).length).toBe(2)
  })
})
