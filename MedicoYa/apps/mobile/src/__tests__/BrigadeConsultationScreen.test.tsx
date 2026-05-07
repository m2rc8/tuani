import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import BrigadeConsultationScreen from '../screens/doctor/BrigadeConsultationScreen'
import { useBrigadeStore } from '../store/brigadeStore'

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
jest.mock('../store/brigadeStore', () => {
  const actual = jest.requireActual('../store/brigadeStore')
  return actual
})

const navigation = { navigate: jest.fn(), goBack: jest.fn() }

const activeBrigade = { id: 'b1', name: 'Brigada Norte', community: 'X', status: 'active' as const }

beforeEach(() => {
  jest.clearAllMocks()
  useBrigadeStore.setState({
    activeBrigade,
    brigades: [],
    patientCache: [{ phone: '+50499111111', name: 'María Cached' }],
    offlineQueue: [],
    syncState: 'idle',
    lastSyncedAt: null,
  })
})

describe('BrigadeConsultationScreen', () => {
  it('renders phone and name fields', () => {
    const { getByTestId } = render(
      <BrigadeConsultationScreen navigation={navigation} route={{ params: {} } as any} />
    )
    expect(getByTestId('phone-input')).toBeTruthy()
    expect(getByTestId('name-input')).toBeTruthy()
  })

  it('autofills name from patientCache on phone blur', async () => {
    const { getByTestId } = render(
      <BrigadeConsultationScreen navigation={navigation} route={{ params: {} } as any} />
    )
    fireEvent.changeText(getByTestId('phone-input'), '+50499111111')
    fireEvent(getByTestId('phone-input'), 'blur')
    await waitFor(() => {
      const nameInput = getByTestId('name-input')
      expect(nameInput.props.value).toBe('María Cached')
    })
  })

  it('save button adds consultation to offlineQueue and navigates back', async () => {
    const { getByTestId } = render(
      <BrigadeConsultationScreen navigation={navigation} route={{ params: {} } as any} />
    )
    fireEvent.changeText(getByTestId('phone-input'), '+50499222222')
    fireEvent.changeText(getByTestId('name-input'), 'Juan Pérez')
    await act(async () => { fireEvent.press(getByTestId('save-btn')) })
    await waitFor(() => {
      const queue = useBrigadeStore.getState().offlineQueue
      expect(queue).toHaveLength(1)
      expect(queue[0].patient_phone).toBe('+50499222222')
      expect(queue[0].patient_name).toBe('Juan Pérez')
      expect(queue[0].synced).toBe(false)
      expect(navigation.goBack).toHaveBeenCalled()
    })
  })

  it('save button does not add to queue when phone is empty', async () => {
    const { getByTestId } = render(
      <BrigadeConsultationScreen navigation={navigation} route={{ params: {} } as any} />
    )
    fireEvent.changeText(getByTestId('name-input'), 'Juan Pérez')
    await act(async () => { fireEvent.press(getByTestId('save-btn')) })
    expect(useBrigadeStore.getState().offlineQueue).toHaveLength(0)
    expect(navigation.goBack).not.toHaveBeenCalled()
  })

  it('loads existing consultation when local_id param is provided', async () => {
    const existingItem = {
      local_id: 'loc-existing',
      patient_phone: '+50499333333',
      patient_name: 'Ana López',
      symptoms_text: 'Fiebre',
      diagnosis: undefined,
      medications: [],
      created_at: new Date().toISOString(),
      synced: false,
    }
    useBrigadeStore.setState({ offlineQueue: [existingItem], activeBrigade, brigades: [], patientCache: [], syncState: 'idle', lastSyncedAt: null })
    const { getByTestId } = render(
      <BrigadeConsultationScreen
        navigation={navigation}
        route={{ params: { local_id: 'loc-existing' } } as any}
      />
    )
    await waitFor(() => {
      expect(getByTestId('phone-input').props.value).toBe('+50499333333')
      expect(getByTestId('name-input').props.value).toBe('Ana López')
    })
  })
})
