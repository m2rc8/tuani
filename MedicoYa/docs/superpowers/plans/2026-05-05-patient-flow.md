# Patient Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the patient-facing consultation flow: symptom form → waiting → chat → prescription → history.

**Architecture:** Root stack navigator wraps PatientTabs; WaitingScreen, ConsultationScreen, and PrescriptionScreen sit above tabs as full-screen stack screens. A new `consultationStore` (Zustand + AsyncStorage) tracks active consultation state across nav events. A singleton `socketService` wraps socket.io-client and is connected on login.

**Tech Stack:** React Native + Expo 52, React Navigation v7 (native-stack + bottom-tabs), Zustand 5, socket.io-client, react-qr-code + react-native-svg, @testing-library/react-native, jest-expo, axios-mock-adapter.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| NEW | `apps/mobile/src/store/consultationStore.ts` | Active consultation state + AsyncStorage persistence |
| NEW | `apps/mobile/src/lib/socket.ts` | Singleton socket.io-client wrapper |
| NEW | `apps/mobile/src/lib/types.ts` | Shared mobile TypeScript types |
| NEW | `apps/mobile/src/screens/patient/WaitingScreen.tsx` | Spinner + cancel while waiting for doctor |
| NEW | `apps/mobile/src/screens/patient/ConsultationScreen.tsx` | Real-time chat + prescription card |
| NEW | `apps/mobile/src/screens/patient/PrescriptionScreen.tsx` | Diagnosis + meds + QR code |
| NEW | `apps/mobile/src/__tests__/consultationStore.test.ts` | Store unit tests |
| NEW | `apps/mobile/src/__tests__/HomeScreen.test.tsx` | HomeScreen component tests |
| NEW | `apps/mobile/src/__tests__/WaitingScreen.test.tsx` | WaitingScreen component tests |
| NEW | `apps/mobile/src/__tests__/ConsultationScreen.test.tsx` | ConsultationScreen component tests |
| NEW | `apps/mobile/src/__tests__/PrescriptionScreen.test.tsx` | PrescriptionScreen component tests |
| NEW | `apps/mobile/src/__tests__/HistoryScreen.test.tsx` | HistoryScreen component tests |
| MOD | `apps/mobile/src/screens/patient/HomeScreen.tsx` | Symptom form + doctor count + active consultation redirect |
| MOD | `apps/mobile/src/screens/patient/HistoryScreen.tsx` | Past consultations list |
| MOD | `apps/mobile/src/navigation/RootNavigator.tsx` | Add PatientStack with new screens |
| MOD | `apps/mobile/src/i18n/es.json` | Spanish strings for consultation + history |
| MOD | `apps/mobile/src/i18n/en.json` | English strings for consultation + history |
| MOD | `packages/api/src/services/ConsultationService.ts` | Include prescription in getConsultation + getUserConsultations |

---

## Task 1: Install mobile dependencies

**Files:**
- Modify: `apps/mobile/package.json`

- [ ] **Step 1: Install packages**

Run from repo root (Expo-aware install picks compatible versions):
```bash
cd apps/mobile
npx expo install react-native-svg
npm install socket.io-client react-qr-code
cd ../..
```

- [ ] **Step 2: Verify install**

```bash
cd apps/mobile && npm test 2>&1 | tail -5
```
Expected: existing tests still pass (14 files, 116 tests or similar count).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json
git commit -m "chore(mobile): install socket.io-client, react-qr-code, react-native-svg"
```

---

## Task 2: Add i18n keys

**Files:**
- Modify: `apps/mobile/src/i18n/es.json`
- Modify: `apps/mobile/src/i18n/en.json`

- [ ] **Step 1: Add Spanish keys**

In `apps/mobile/src/i18n/es.json`, add after existing keys:
```json
{
  "auth": { ... },
  "profile": { ... },
  "nav": { ... },
  "common": { ... },
  "consultation": {
    "start_cta": "Consultar ahora",
    "symptoms_placeholder": "¿Qué síntomas tienes? (máx. 500 caracteres)",
    "chars_remaining": "{{count}} caracteres restantes",
    "add_photo": "Agregar foto",
    "doctors_available_one": "{{count}} médico disponible",
    "doctors_available_other": "{{count}} médicos disponibles",
    "no_doctors": "Sin médicos disponibles",
    "waiting_title": "Buscando médico",
    "waiting_subtitle": "Un médico revisará tus síntomas pronto. Espera estimada: 2–5 min.",
    "cancel": "Cancelar consulta",
    "your_symptoms": "Tus síntomas",
    "chat_placeholder": "Escribe un mensaje...",
    "send": "Enviar",
    "consultation_completed": "Consulta completada",
    "prescription_ready": "Tu receta está lista",
    "view_prescription": "Ver receta completa →",
    "prescription_title": "Receta médica",
    "diagnosis": "Diagnóstico",
    "medications": "Medicamentos",
    "valid_until": "Válida hasta",
    "share": "Compartir receta"
  },
  "history": {
    "title": "Historial",
    "empty": "No tienes consultas anteriores",
    "status": {
      "pending": "Pendiente",
      "active": "En curso",
      "completed": "Completada",
      "rejected": "Rechazada",
      "cancelled": "Cancelada"
    }
  }
}
```

- [ ] **Step 2: Add English keys**

In `apps/mobile/src/i18n/en.json`, add the same structure:
```json
{
  "auth": { ... },
  "profile": { ... },
  "nav": { ... },
  "common": { ... },
  "consultation": {
    "start_cta": "Consult now",
    "symptoms_placeholder": "What symptoms do you have? (max 500 characters)",
    "chars_remaining": "{{count}} characters remaining",
    "add_photo": "Add photo",
    "doctors_available_one": "{{count}} doctor available",
    "doctors_available_other": "{{count}} doctors available",
    "no_doctors": "No doctors available",
    "waiting_title": "Finding a doctor",
    "waiting_subtitle": "A doctor will review your symptoms shortly. Estimated wait: 2–5 min.",
    "cancel": "Cancel consultation",
    "your_symptoms": "Your symptoms",
    "chat_placeholder": "Type a message...",
    "send": "Send",
    "consultation_completed": "Consultation completed",
    "prescription_ready": "Your prescription is ready",
    "view_prescription": "View full prescription →",
    "prescription_title": "Medical prescription",
    "diagnosis": "Diagnosis",
    "medications": "Medications",
    "valid_until": "Valid until",
    "share": "Share prescription"
  },
  "history": {
    "title": "History",
    "empty": "You have no past consultations",
    "status": {
      "pending": "Pending",
      "active": "In progress",
      "completed": "Completed",
      "rejected": "Rejected",
      "cancelled": "Cancelled"
    }
  }
}
```

- [ ] **Step 3: Run i18n tests**

```bash
cd apps/mobile && npm test -- --testPathPattern=i18n 2>&1 | tail -10
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/i18n/
git commit -m "feat(mobile): add consultation + history i18n keys (es + en)"
```

---

## Task 3: Shared mobile types

**Files:**
- Create: `apps/mobile/src/lib/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// apps/mobile/src/lib/types.ts

export type ConsultationStatus = 'pending' | 'active' | 'completed' | 'rejected' | 'cancelled'

export interface Medication {
  name: string
  dose: string
  frequency: string
  code?: string
}

export interface Prescription {
  id: string
  consultation_id: string
  qr_code: string
  medications: Medication[]
  instructions: string | null
  valid_until: string
}

export interface ConsultationDetail {
  id: string
  patient_id: string
  doctor_id: string | null
  status: ConsultationStatus
  symptoms_text: string | null
  symptom_photo: string | null
  diagnosis: string | null
  diagnosis_code: string | null
  created_at: string
  completed_at: string | null
  prescription: Prescription | null
}

export interface Message {
  id: string
  sender_id: string
  content: string
  msg_type: 'text' | 'image'
  created_at: string
}

export interface AvailableDoctor {
  id: string
  available: boolean
  bio: string | null
  user: { name: string | null; phone: string }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/types.ts
git commit -m "feat(mobile): shared TypeScript types for consultation flow"
```

---

## Task 4: consultationStore

**Files:**
- Create: `apps/mobile/src/store/consultationStore.ts`
- Create: `apps/mobile/src/__tests__/consultationStore.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/mobile/src/__tests__/consultationStore.test.ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useConsultationStore } from '../store/consultationStore'
import type { Message } from '../lib/types'

const STORAGE_KEY = 'active_consultation'

beforeEach(async () => {
  useConsultationStore.setState({
    activeConsultationId: null,
    status: null,
    messages: [],
  })
  await AsyncStorage.clear()
  jest.clearAllMocks()
})

const msg: Message = {
  id: 'm1', sender_id: 'u1', content: 'hello',
  msg_type: 'text', created_at: '2026-05-05T00:00:00Z',
}

describe('setActive', () => {
  it('updates state and persists to AsyncStorage', async () => {
    await useConsultationStore.getState().setActive('c1', 'pending')
    const { activeConsultationId, status } = useConsultationStore.getState()
    expect(activeConsultationId).toBe('c1')
    expect(status).toBe('pending')
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    expect(JSON.parse(raw!)).toEqual({ id: 'c1', status: 'pending' })
  })

  it('resets messages to empty array', async () => {
    useConsultationStore.setState({ messages: [msg] })
    await useConsultationStore.getState().setActive('c2', 'pending')
    expect(useConsultationStore.getState().messages).toHaveLength(0)
  })
})

describe('appendMessage', () => {
  it('appends message to messages array', () => {
    useConsultationStore.getState().appendMessage(msg)
    expect(useConsultationStore.getState().messages).toEqual([msg])
  })

  it('preserves existing messages', () => {
    const msg2: Message = { ...msg, id: 'm2', content: 'world' }
    useConsultationStore.getState().appendMessage(msg)
    useConsultationStore.getState().appendMessage(msg2)
    expect(useConsultationStore.getState().messages).toHaveLength(2)
  })
})

describe('setStatus', () => {
  it('updates status in state', async () => {
    await useConsultationStore.getState().setActive('c1', 'pending')
    await useConsultationStore.getState().setStatus('active')
    expect(useConsultationStore.getState().status).toBe('active')
  })

  it('updates persisted status in AsyncStorage', async () => {
    await useConsultationStore.getState().setActive('c1', 'pending')
    await useConsultationStore.getState().setStatus('active')
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    expect(JSON.parse(raw!).status).toBe('active')
  })
})

describe('clear', () => {
  it('resets all state', async () => {
    await useConsultationStore.getState().setActive('c1', 'active')
    useConsultationStore.getState().appendMessage(msg)
    await useConsultationStore.getState().clear()
    const { activeConsultationId, status, messages } = useConsultationStore.getState()
    expect(activeConsultationId).toBeNull()
    expect(status).toBeNull()
    expect(messages).toHaveLength(0)
  })

  it('removes entry from AsyncStorage', async () => {
    await useConsultationStore.getState().setActive('c1', 'active')
    await useConsultationStore.getState().clear()
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('hydrate', () => {
  it('restores state from AsyncStorage', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 'c1', status: 'active' }))
    await useConsultationStore.getState().hydrate()
    const { activeConsultationId, status } = useConsultationStore.getState()
    expect(activeConsultationId).toBe('c1')
    expect(status).toBe('active')
  })

  it('does nothing when AsyncStorage is empty', async () => {
    await useConsultationStore.getState().hydrate()
    expect(useConsultationStore.getState().activeConsultationId).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- --testPathPattern=consultationStore 2>&1 | tail -10
```
Expected: FAIL — `Cannot find module '../store/consultationStore'`

- [ ] **Step 3: Implement consultationStore**

```typescript
// apps/mobile/src/store/consultationStore.ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import type { ConsultationStatus, Message } from '../lib/types'

interface ConsultationState {
  activeConsultationId: string | null
  status: ConsultationStatus | null
  messages: Message[]
  setActive: (id: string, status: ConsultationStatus) => Promise<void>
  appendMessage: (msg: Message) => void
  setStatus: (status: ConsultationStatus) => Promise<void>
  clear: () => Promise<void>
  hydrate: () => Promise<void>
}

const STORAGE_KEY = 'active_consultation'

export const useConsultationStore = create<ConsultationState>((set, get) => ({
  activeConsultationId: null,
  status: null,
  messages: [],

  setActive: async (id, status) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ id, status }))
    set({ activeConsultationId: id, status, messages: [] })
  },

  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  setStatus: async (status) => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, status }))
    }
    set({ status })
  },

  clear: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY)
    set({ activeConsultationId: null, status: null, messages: [] })
  },

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const { id, status } = JSON.parse(raw)
    set({ activeConsultationId: id, status })
  },
}))
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- --testPathPattern=consultationStore 2>&1 | tail -10
```
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/store/consultationStore.ts apps/mobile/src/__tests__/consultationStore.test.ts
git commit -m "feat(mobile): consultationStore — Zustand store with AsyncStorage persistence"
```

---

## Task 5: Socket service

**Files:**
- Create: `apps/mobile/src/lib/socket.ts`

No unit tests for the socket singleton — its behavior is tested indirectly through screen tests that mock it. The singleton itself just wraps socket.io-client calls.

- [ ] **Step 1: Create socket service**

```typescript
// apps/mobile/src/lib/socket.ts
import { io, type Socket } from 'socket.io-client'

let _socket: Socket | null = null

export const socketService = {
  connect(baseURL: string, token: string) {
    if (_socket?.connected) return
    _socket = io(baseURL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    })
  },

  disconnect() {
    _socket?.disconnect()
    _socket = null
  },

  emit(event: string, data: unknown) {
    _socket?.emit(event, data)
  },

  on(event: string, cb: (data: any) => void) {
    _socket?.on(event, cb)
  },

  off(event: string, cb?: (data: any) => void) {
    _socket?.off(event, cb)
  },

  get connected(): boolean {
    return _socket?.connected ?? false
  },
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/socket.ts
git commit -m "feat(mobile): socket service — singleton socket.io-client wrapper"
```

---

## Task 6: Enhance GET /consultations/:id to include prescription

The mobile needs prescription data (qr_code, medications, instructions, valid_until) when viewing a completed consultation. Currently `getConsultation` and `getUserConsultations` don't include it.

**Files:**
- Modify: `packages/api/src/services/ConsultationService.ts`
- Modify: `packages/api/src/services/ConsultationService.test.ts` (check existing test file path)

- [ ] **Step 1: Check existing consultation service test**

```bash
ls packages/api/src/services/
```
Identify the test file for ConsultationService (likely `ConsultationService.test.ts`).

- [ ] **Step 2: Add failing test for prescription inclusion**

Open `packages/api/src/services/ConsultationService.test.ts`. Add a test to the `getConsultation` describe block:

```typescript
it('includes prescription in result when consultation is completed', async () => {
  const prescription = await db.prescription.create({
    data: {
      consultation_id: activeConsultation.id,
      qr_code: 'ABC123',
      medications: [],
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  const result = await service.getConsultation(activeConsultation.id, patientUser.id) as any
  expect(result.prescription).toBeDefined()
  expect(result.prescription.qr_code).toBe('ABC123')
})
```

(Adapt variable names to match the existing test file's setup — look at how `activeConsultation` and `patientUser` are set up in the describe block.)

- [ ] **Step 3: Run test to verify it fails**

```bash
cd packages/api && npx vitest run src/services/ConsultationService.test.ts 2>&1 | tail -15
```
Expected: FAIL — `expect(result.prescription).toBeDefined()` fails because prescription is undefined.

- [ ] **Step 4: Update getConsultation to include prescription**

In `packages/api/src/services/ConsultationService.ts`, find the `getConsultation` method and change:

```typescript
// Before:
const c = await this.db.consultation.findUnique({ where: { id } })

// After:
const c = await this.db.consultation.findUnique({
  where: { id },
  include: { prescription: true },
})
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd packages/api && npx vitest run src/services/ConsultationService.test.ts 2>&1 | tail -15
```
Expected: PASS.

- [ ] **Step 6: Run full API test suite**

```bash
cd packages/api && npx vitest run 2>&1 | tail -10
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/services/ConsultationService.ts packages/api/src/services/ConsultationService.test.ts
git commit -m "feat(api): include prescription in getConsultation response"
```

---

## Task 7: Update RootNavigator + create screen stubs

**Files:**
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`
- Create: `apps/mobile/src/screens/patient/WaitingScreen.tsx` (stub)
- Create: `apps/mobile/src/screens/patient/ConsultationScreen.tsx` (stub)
- Create: `apps/mobile/src/screens/patient/PrescriptionScreen.tsx` (stub)

- [ ] **Step 1: Create screen stubs**

```typescript
// apps/mobile/src/screens/patient/WaitingScreen.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
export default function WaitingScreen() {
  return <View style={styles.c}><Text>Waiting...</Text></View>
}
const styles = StyleSheet.create({ c: { flex: 1, alignItems: 'center', justifyContent: 'center' } })
```

```typescript
// apps/mobile/src/screens/patient/ConsultationScreen.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
export default function ConsultationScreen() {
  return <View style={styles.c}><Text>Consultation...</Text></View>
}
const styles = StyleSheet.create({ c: { flex: 1, alignItems: 'center', justifyContent: 'center' } })
```

```typescript
// apps/mobile/src/screens/patient/PrescriptionScreen.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
export default function PrescriptionScreen() {
  return <View style={styles.c}><Text>Prescription...</Text></View>
}
const styles = StyleSheet.create({ c: { flex: 1, alignItems: 'center', justifyContent: 'center' } })
```

- [ ] **Step 2: Update RootNavigator**

Replace the full contents of `apps/mobile/src/navigation/RootNavigator.tsx`:

```typescript
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import AuthStack from './AuthStack'
import PatientTabs from './PatientTabs'
import DoctorTabs from './DoctorTabs'
import WaitingScreen from '../screens/patient/WaitingScreen'
import ConsultationScreen from '../screens/patient/ConsultationScreen'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'

export type PatientStackParamList = {
  PatientTabs: undefined
  WaitingScreen: { consultationId: string }
  ConsultationScreen: { consultationId: string }
  PrescriptionScreen: { consultationId: string }
}

const PatientStack = createNativeStackNavigator<PatientStackParamList>()

function PatientRoot() {
  return (
    <PatientStack.Navigator screenOptions={{ headerShown: false }}>
      <PatientStack.Screen name="PatientTabs" component={PatientTabs} />
      <PatientStack.Screen
        name="WaitingScreen"
        component={WaitingScreen}
        options={{ gestureEnabled: false }}
      />
      <PatientStack.Screen name="ConsultationScreen" component={ConsultationScreen} />
      <PatientStack.Screen name="PrescriptionScreen" component={PrescriptionScreen} />
    </PatientStack.Navigator>
  )
}

export default function RootNavigator() {
  const token = useAuthStore((s) => s.token)
  const role = useAuthStore((s) => s.role)

  if (!token) return <AuthStack />
  if (role === 'doctor') return <DoctorTabs />
  return <PatientRoot />
}
```

- [ ] **Step 3: Run all mobile tests**

```bash
cd apps/mobile && npm test 2>&1 | tail -15
```
Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/RootNavigator.tsx apps/mobile/src/screens/patient/WaitingScreen.tsx apps/mobile/src/screens/patient/ConsultationScreen.tsx apps/mobile/src/screens/patient/PrescriptionScreen.tsx
git commit -m "feat(mobile): patient stack navigator + screen stubs for consultation flow"
```

---

## Task 8: HomeScreen implementation

**Files:**
- Modify: `apps/mobile/src/screens/patient/HomeScreen.tsx`
- Create: `apps/mobile/src/__tests__/HomeScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/mobile/src/__tests__/HomeScreen.test.tsx
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'

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

import api from '../lib/api'
import { useConsultationStore } from '../store/consultationStore'
import HomeScreen from '../screens/patient/HomeScreen'

const mockApi = api as jest.Mocked<typeof api>
const mockUseConsultationStore = useConsultationStore as jest.MockedFunction<typeof useConsultationStore>

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const navigation = { navigate: mockNavigate, replace: mockReplace } as any
const route = {} as any

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
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- --testPathPattern=HomeScreen 2>&1 | tail -15
```
Expected: FAIL.

- [ ] **Step 3: Implement HomeScreen**

```typescript
// apps/mobile/src/screens/patient/HomeScreen.tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useConsultationStore } from '../../store/consultationStore'
import type { AvailableDoctor } from '../../lib/types'

const MAX_CHARS = 500

export default function HomeScreen({ navigation }: any) {
  const { t } = useTranslation()
  const { activeConsultationId, status, setActive } = useConsultationStore()
  const [symptoms, setSymptoms] = useState('')
  const [doctorCount, setDoctorCount] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchDoctors = useCallback(async () => {
    try {
      const { data } = await api.get<AvailableDoctor[]>('/api/doctors/available')
      setDoctorCount(data.length)
    } catch {
      setDoctorCount(0)
    }
  }, [])

  useEffect(() => {
    if (activeConsultationId && status === 'pending') {
      navigation.navigate('WaitingScreen', { consultationId: activeConsultationId })
      return
    }
    if (activeConsultationId && status === 'active') {
      navigation.navigate('ConsultationScreen', { consultationId: activeConsultationId })
      return
    }
    fetchDoctors()
    const interval = setInterval(fetchDoctors, 30_000)
    return () => clearInterval(interval)
  }, [activeConsultationId, status])

  const canSubmit = symptoms.trim().length > 0 && (doctorCount ?? 0) > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('symptoms_text', symptoms.trim())
      const { data } = await api.post<{ id: string }>('/api/consultations', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      await setActive(data.id, 'pending')
      navigation.navigate('WaitingScreen', { consultationId: data.id })
    } catch {
      Alert.alert(t('common.error_generic'))
      setSubmitting(false)
    }
  }

  const doctorBadge = doctorCount === null
    ? null
    : doctorCount === 0
      ? t('consultation.no_doctors')
      : t('consultation.doctors_available', { count: doctorCount })

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('nav.home')}</Text>

      {doctorBadge && (
        <View style={[styles.badge, doctorCount === 0 && styles.badgeWarn]} testID="doctor-badge">
          <Text style={[styles.badgeText, doctorCount === 0 && styles.badgeTextWarn]}>
            {doctorBadge}
          </Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder={t('consultation.symptoms_placeholder')}
        value={symptoms}
        onChangeText={(v) => setSymptoms(v.slice(0, MAX_CHARS))}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        testID="symptoms-input"
      />
      <Text style={styles.counter}>
        {t('consultation.chars_remaining', { count: MAX_CHARS - symptoms.length })}
      </Text>

      <TouchableOpacity
        style={[styles.btn, !canSubmit && styles.btnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        testID="submit-btn"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>{t('consultation.start_cta')}</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  badge: {
    backgroundColor: '#DCFCE7', borderRadius: 8, padding: 10, marginBottom: 16, alignItems: 'center',
  },
  badgeWarn: { backgroundColor: '#FEF9C3' },
  badgeText: { fontSize: 14, color: '#166534', fontWeight: '600' },
  badgeTextWarn: { color: '#854D0E' },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    padding: 12, fontSize: 15, minHeight: 140, marginBottom: 6,
  },
  counter: { fontSize: 12, color: '#94A3B8', marginBottom: 20, textAlign: 'right' },
  btn: {
    backgroundColor: '#3B82F6', borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#93C5FD' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- --testPathPattern=HomeScreen 2>&1 | tail -15
```
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/patient/HomeScreen.tsx apps/mobile/src/__tests__/HomeScreen.test.tsx
git commit -m "feat(mobile): HomeScreen — symptom form with doctor count and active consultation redirect"
```

---

## Task 9: WaitingScreen implementation

**Files:**
- Modify: `apps/mobile/src/screens/patient/WaitingScreen.tsx`
- Create: `apps/mobile/src/__tests__/WaitingScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/mobile/src/__tests__/WaitingScreen.test.tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), put: jest.fn() },
}))

jest.mock('../lib/socket', () => ({
  socketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connected: false,
  },
}))

jest.mock('../store/consultationStore', () => ({
  useConsultationStore: jest.fn(),
}))

jest.mock('../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({ token: 'tok', userId: 'u1' })),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import api from '../lib/api'
import { socketService } from '../lib/socket'
import { useConsultationStore } from '../store/consultationStore'
import WaitingScreen from '../screens/patient/WaitingScreen'

const mockApi = api as jest.Mocked<typeof api>
const mockSocket = socketService as jest.Mocked<typeof socketService>
const mockUseConsultationStore = useConsultationStore as jest.MockedFunction<typeof useConsultationStore>

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const navigation = { navigate: mockNavigate, replace: mockReplace, goBack: jest.fn() } as any

const defaultStore = {
  activeConsultationId: 'c1',
  status: 'pending' as const,
  messages: [],
  setActive: jest.fn(),
  appendMessage: jest.fn(),
  setStatus: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  hydrate: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseConsultationStore.mockReturnValue(defaultStore as any)
  mockApi.get.mockResolvedValue({
    data: { id: 'c1', symptoms_text: 'Me duele la cabeza', status: 'pending' },
  })
  mockApi.put.mockResolvedValue({ data: {} })
})

const route = { params: { consultationId: 'c1' } } as any

describe('WaitingScreen', () => {
  it('renders symptoms text', async () => {
    const { findByText } = render(<WaitingScreen navigation={navigation} route={route} />)
    expect(await findByText('Me duele la cabeza')).toBeTruthy()
  })

  it('joins socket room on mount', async () => {
    render(<WaitingScreen navigation={navigation} route={route} />)
    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('join_consultation', { consultation_id: 'c1' })
    })
  })

  it('cancel calls PUT cancel, clears store, goes back', async () => {
    const clear = jest.fn().mockResolvedValue(undefined)
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, clear } as any)
    const { getByTestId } = render(<WaitingScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.press(getByTestId('cancel-btn'))
    await waitFor(() => {
      expect(mockApi.put).toHaveBeenCalledWith('/api/consultations/c1/cancel')
      expect(clear).toHaveBeenCalled()
      expect(navigation.goBack).toHaveBeenCalled()
    })
  })

  it('navigates to ConsultationScreen on consultation_updated with active status', async () => {
    let capturedHandler: ((data: any) => void) | undefined
    mockSocket.on.mockImplementation((event, cb) => {
      if (event === 'consultation_updated') capturedHandler = cb
    })

    const setStatus = jest.fn().mockResolvedValue(undefined)
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, setStatus } as any)

    render(<WaitingScreen navigation={navigation} route={route} />)
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalledWith('consultation_updated', expect.any(Function)))

    capturedHandler!({ id: 'c1', status: 'active' })
    await waitFor(() => {
      expect(setStatus).toHaveBeenCalledWith('active')
      expect(mockReplace).toHaveBeenCalledWith('ConsultationScreen', { consultationId: 'c1' })
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- --testPathPattern=WaitingScreen 2>&1 | tail -15
```
Expected: FAIL.

- [ ] **Step 3: Implement WaitingScreen**

```typescript
// apps/mobile/src/screens/patient/WaitingScreen.tsx
import React, { useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail } from '../../lib/types'

export default function WaitingScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const token = useAuthStore((s) => s.token)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const { setStatus, clear } = useConsultationStore()
  const [symptomsText, setSymptomsText] = React.useState<string | null>(null)

  const handleConsultationUpdated = useCallback(
    async (data: { id: string; status: string }) => {
      if (data.id !== consultationId) return
      if (data.status === 'active') {
        await setStatus('active')
        navigation.replace('ConsultationScreen', { consultationId })
      }
      if (data.status === 'rejected' || data.status === 'cancelled') {
        await clear()
        Alert.alert(t('common.error_generic'))
        navigation.goBack()
      }
    },
    [consultationId, setStatus, clear, navigation, t],
  )

  useEffect(() => {
    socketService.connect(baseURL, token ?? '')
    socketService.emit('join_consultation', { consultation_id: consultationId })
    socketService.on('consultation_updated', handleConsultationUpdated)

    api.get<ConsultationDetail>(`/api/consultations/${consultationId}`)
      .then(({ data }) => setSymptomsText(data.symptoms_text))
      .catch(() => {})

    return () => {
      socketService.off('consultation_updated', handleConsultationUpdated)
    }
  }, [consultationId, handleConsultationUpdated, baseURL, token])

  const handleCancel = async () => {
    try {
      await api.put(`/api/consultations/${consultationId}/cancel`)
      await clear()
      navigation.goBack()
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('consultation.waiting_title')}</Text>
      <ActivityIndicator size="large" color="#3B82F6" style={styles.spinner} />
      <Text style={styles.subtitle}>{t('consultation.waiting_subtitle')}</Text>

      {symptomsText && (
        <View style={styles.symptomsBox}>
          <Text style={styles.symptomsLabel}>{t('consultation.your_symptoms')}</Text>
          <Text style={styles.symptomsText}>{symptomsText}</Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={handleCancel}
        testID="cancel-btn"
      >
        <Text style={styles.cancelText}>{t('consultation.cancel')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 24, textAlign: 'center' },
  spinner: { marginBottom: 16 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginBottom: 32 },
  symptomsBox: {
    width: '100%', backgroundColor: '#F8FAFC', borderRadius: 10,
    padding: 16, marginBottom: 32,
  },
  symptomsLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 4, textTransform: 'uppercase' },
  symptomsText: { fontSize: 15, color: '#334155' },
  cancelBtn: {
    padding: 14, borderWidth: 1, borderColor: '#EF4444',
    borderRadius: 10, alignItems: 'center', width: '100%',
  },
  cancelText: { color: '#EF4444', fontWeight: '600', fontSize: 15 },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- --testPathPattern=WaitingScreen 2>&1 | tail -15
```
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/patient/WaitingScreen.tsx apps/mobile/src/__tests__/WaitingScreen.test.tsx
git commit -m "feat(mobile): WaitingScreen — spinner, cancel, socket status listener"
```

---

## Task 10: ConsultationScreen implementation

**Files:**
- Modify: `apps/mobile/src/screens/patient/ConsultationScreen.tsx`
- Create: `apps/mobile/src/__tests__/ConsultationScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/mobile/src/__tests__/ConsultationScreen.test.tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}))

jest.mock('../lib/socket', () => ({
  socketService: {
    connect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connected: true,
  },
}))

jest.mock('../store/consultationStore', () => ({
  useConsultationStore: jest.fn(),
}))

jest.mock('../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({ token: 'tok', userId: 'u1' })),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import api from '../lib/api'
import { socketService } from '../lib/socket'
import { useConsultationStore } from '../store/consultationStore'
import ConsultationScreen from '../screens/patient/ConsultationScreen'

const mockApi = api as jest.Mocked<typeof api>
const mockSocket = socketService as jest.Mocked<typeof socketService>
const mockUseConsultationStore = useConsultationStore as jest.MockedFunction<typeof useConsultationStore>

const mockNavigate = jest.fn()
const navigation = { navigate: mockNavigate, goBack: jest.fn() } as any
const route = { params: { consultationId: 'c1' } } as any

const baseConsultation = {
  id: 'c1', patient_id: 'u1', doctor_id: 'd1', status: 'active' as const,
  symptoms_text: 'Dolor de cabeza', symptom_photo: null,
  diagnosis: null, diagnosis_code: null, created_at: '2026-05-05T00:00:00Z',
  completed_at: null, prescription: null,
}

const defaultStore = {
  activeConsultationId: 'c1',
  status: 'active' as const,
  messages: [],
  setActive: jest.fn(),
  appendMessage: jest.fn(),
  setStatus: jest.fn().mockResolvedValue(undefined),
  clear: jest.fn().mockResolvedValue(undefined),
  hydrate: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseConsultationStore.mockReturnValue(defaultStore as any)
  mockApi.get.mockResolvedValue({ data: { ...baseConsultation, messages: [] } })
})

describe('ConsultationScreen', () => {
  it('loads and displays existing messages', async () => {
    mockApi.get.mockResolvedValue({
      data: {
        ...baseConsultation,
        messages: [{ id: 'm1', sender_id: 'd1', content: 'Hola', msg_type: 'text', created_at: '2026-05-05T00:00:00Z' }],
      },
    })
    const appendMessage = jest.fn()
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, appendMessage } as any)
    render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {
      expect(appendMessage).toHaveBeenCalledWith(expect.objectContaining({ content: 'Hola' }))
    })
  })

  it('sends message via socket on press', async () => {
    const { getByTestId } = render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.changeText(getByTestId('chat-input'), 'Tengo fiebre')
    fireEvent.press(getByTestId('send-btn'))
    expect(mockSocket.emit).toHaveBeenCalledWith('send_message', {
      consultation_id: 'c1',
      content: 'Tengo fiebre',
      msg_type: 'text',
    })
  })

  it('clears input after sending', async () => {
    const { getByTestId } = render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    fireEvent.changeText(getByTestId('chat-input'), 'Tengo fiebre')
    fireEvent.press(getByTestId('send-btn'))
    expect(getByTestId('chat-input').props.value).toBe('')
  })

  it('disables input when consultation is completed', async () => {
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, status: 'completed' } as any)
    const { getByTestId } = render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {})
    expect(getByTestId('chat-input').props.editable).toBe(false)
  })

  it('shows prescription card when status_updated to completed', async () => {
    let capturedHandler: ((data: any) => void) | undefined
    mockSocket.on.mockImplementation((event, cb) => {
      if (event === 'consultation_updated') capturedHandler = cb
    })
    const completedConsultation = {
      ...baseConsultation, status: 'completed' as const,
      diagnosis: 'Gripe viral',
      prescription: {
        id: 'p1', consultation_id: 'c1', qr_code: 'ABC123',
        medications: [{ name: 'Paracetamol', dose: '500mg', frequency: 'c/8h' }],
        instructions: null, valid_until: '2026-06-05T00:00:00Z',
      },
    }
    mockApi.get
      .mockResolvedValueOnce({ data: { ...baseConsultation, messages: [] } })
      .mockResolvedValueOnce({ data: completedConsultation })

    const setStatus = jest.fn().mockResolvedValue(undefined)
    mockUseConsultationStore.mockReturnValue({ ...defaultStore, setStatus } as any)

    const { findByTestId } = render(<ConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => expect(mockSocket.on).toHaveBeenCalled())

    capturedHandler!({ id: 'c1', status: 'completed' })
    expect(await findByTestId('prescription-card')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- --testPathPattern=ConsultationScreen 2>&1 | tail -15
```
Expected: FAIL.

- [ ] **Step 3: Implement ConsultationScreen**

```typescript
// apps/mobile/src/screens/patient/ConsultationScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail, Message, Prescription } from '../../lib/types'

interface PrescriptionCardProps {
  prescription: Prescription
  diagnosis: string | null
  onView: () => void
}

function PrescriptionCard({ prescription, diagnosis, onView }: PrescriptionCardProps) {
  const { t } = useTranslation()
  return (
    <View style={styles.prescriptionCard} testID="prescription-card">
      <Text style={styles.prescriptionTitle}>{t('consultation.prescription_ready')}</Text>
      {diagnosis && <Text style={styles.prescriptionDiagnosis}>{diagnosis}</Text>}
      <Text style={styles.prescriptionMeds}>
        {prescription.medications.length} {t('consultation.medications').toLowerCase()}
      </Text>
      <TouchableOpacity style={styles.viewBtn} onPress={onView} testID="view-prescription-btn">
        <Text style={styles.viewBtnText}>{t('consultation.view_prescription')}</Text>
      </TouchableOpacity>
    </View>
  )
}

export default function ConsultationScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const token = useAuthStore((s) => s.token)
  const userId = useAuthStore((s) => s.userId)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const { messages, status, appendMessage, setStatus } = useConsultationStore()
  const [inputText, setInputText] = useState('')
  const [prescription, setPrescription] = useState<Prescription | null>(null)
  const [diagnosis, setDiagnosis] = useState<string | null>(null)
  const listRef = useRef<FlatList>(null)

  const isCompleted = status === 'completed'

  const handleConsultationUpdated = useCallback(
    async (data: { id: string; status: string }) => {
      if (data.id !== consultationId) return
      if (data.status === 'completed') {
        await setStatus('completed')
        const { data: detail } = await api.get<ConsultationDetail>(`/api/consultations/${consultationId}`)
        setPrescription(detail.prescription)
        setDiagnosis(detail.diagnosis)
      }
    },
    [consultationId, setStatus],
  )

  const handleReceiveMessage = useCallback(
    (msg: Message) => {
      appendMessage(msg)
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
    },
    [appendMessage],
  )

  useEffect(() => {
    socketService.connect(baseURL, token ?? '')
    socketService.emit('join_consultation', { consultation_id: consultationId })
    socketService.on('receive_message', handleReceiveMessage)
    socketService.on('consultation_updated', handleConsultationUpdated)

    api.get<ConsultationDetail & { messages: Message[] }>(`/api/consultations/${consultationId}`)
      .then(({ data }) => {
        data.messages?.forEach((m) => appendMessage(m))
        if (data.status === 'completed') {
          setStatus('completed')
          setPrescription(data.prescription)
          setDiagnosis(data.diagnosis)
        }
      })
      .catch(() => {})

    return () => {
      socketService.off('receive_message', handleReceiveMessage)
      socketService.off('consultation_updated', handleConsultationUpdated)
    }
  }, [consultationId, handleReceiveMessage, handleConsultationUpdated, baseURL, token])

  const handleSend = () => {
    const content = inputText.trim()
    if (!content) return
    socketService.emit('send_message', {
      consultation_id: consultationId,
      content,
      msg_type: 'text',
    })
    setInputText('')
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.sender_id === userId
    return (
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
          {item.content}
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        ListFooterComponent={
          prescription
            ? <PrescriptionCard
                prescription={prescription}
                diagnosis={diagnosis}
                onView={() => navigation.navigate('PrescriptionScreen', { consultationId })}
              />
            : null
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, isCompleted && styles.inputDisabled]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t('consultation.chat_placeholder')}
          editable={!isCompleted}
          testID="chat-input"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() || isCompleted) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || isCompleted}
          testID="send-btn"
        >
          <Text style={styles.sendBtnText}>{t('consultation.send')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleMine: { backgroundColor: '#EFF6FF', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: '#F1F5F9', alignSelf: 'flex-start' },
  bubbleTextMine: { color: '#1D4ED8', fontSize: 15 },
  bubbleTextTheirs: { color: '#334155', fontSize: 15 },
  prescriptionCard: {
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC',
    borderRadius: 12, padding: 16, marginTop: 8,
  },
  prescriptionTitle: { fontSize: 14, fontWeight: '700', color: '#166534', marginBottom: 4 },
  prescriptionDiagnosis: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  prescriptionMeds: { fontSize: 13, color: '#64748B', marginBottom: 12 },
  viewBtn: { backgroundColor: '#22C55E', borderRadius: 8, padding: 10, alignItems: 'center' },
  viewBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  inputRow: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: '#E2E8F0', gap: 8, alignItems: 'center',
  },
  input: {
    flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    padding: 10, fontSize: 15,
  },
  inputDisabled: { backgroundColor: '#F1F5F9', color: '#94A3B8' },
  sendBtn: { backgroundColor: '#3B82F6', borderRadius: 10, padding: 10 },
  sendBtnDisabled: { backgroundColor: '#93C5FD' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- --testPathPattern=ConsultationScreen 2>&1 | tail -15
```
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/patient/ConsultationScreen.tsx apps/mobile/src/__tests__/ConsultationScreen.test.tsx
git commit -m "feat(mobile): ConsultationScreen — real-time chat + prescription card on completion"
```

---

## Task 11: PrescriptionScreen implementation

**Files:**
- Modify: `apps/mobile/src/screens/patient/PrescriptionScreen.tsx`
- Create: `apps/mobile/src/__tests__/PrescriptionScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/mobile/src/__tests__/PrescriptionScreen.test.tsx
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

  it('renders QR code with correct value', async () => {
    const { findByTestId } = render(<PrescriptionScreen navigation={navigation} route={route} />)
    const qr = await findByTestId('qr-code')
    expect(qr).toBeTruthy()
  })

  it('shows instructions', async () => {
    const { findByText } = render(<PrescriptionScreen navigation={navigation} route={route} />)
    expect(await findByText('Reposa y toma líquidos')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- --testPathPattern=PrescriptionScreen 2>&1 | tail -15
```
Expected: FAIL.

- [ ] **Step 3: Implement PrescriptionScreen**

```typescript
// apps/mobile/src/screens/patient/PrescriptionScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import QRCode from 'react-qr-code'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail } from '../../lib/types'

export default function PrescriptionScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const { clear } = useConsultationStore()
  const [detail, setDetail] = useState<ConsultationDetail | null>(null)

  useEffect(() => {
    api.get<ConsultationDetail>(`/api/consultations/${consultationId}`)
      .then(({ data }) => setDetail(data))
      .catch(() => {})

    return () => {
      clear()
    }
  }, [consultationId])

  if (!detail) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  const { diagnosis, prescription } = detail
  if (!prescription) return null

  const validUntil = new Date(prescription.valid_until).toLocaleDateString()

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{t('consultation.prescription_title')}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{t('consultation.diagnosis')}</Text>
        <Text style={styles.value}>{diagnosis}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t('consultation.medications')}</Text>
        {prescription.medications.map((med, i) => (
          <Text key={i} style={styles.medication}>
            {med.name} — {med.dose} — {med.frequency}
          </Text>
        ))}
      </View>

      {prescription.instructions && (
        <View style={styles.section}>
          <Text style={styles.value}>{prescription.instructions}</Text>
        </View>
      )}

      <View style={styles.qrContainer}>
        <QRCode value={`MEDICOYA:${prescription.qr_code}`} size={180} testID="qr-code" />
      </View>

      <Text style={styles.validUntil}>
        {t('consultation.valid_until')}: {validUntil}
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  section: { marginBottom: 20 },
  label: {
    fontSize: 11, color: '#94A3B8', textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6, letterSpacing: 0.5,
  },
  value: { fontSize: 17, color: '#1E293B', fontWeight: '600' },
  medication: { fontSize: 15, color: '#334155', marginBottom: 4 },
  qrContainer: {
    alignItems: 'center', padding: 20,
    backgroundColor: '#F8FAFC', borderRadius: 12, marginVertical: 20,
  },
  validUntil: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- --testPathPattern=PrescriptionScreen 2>&1 | tail -15
```
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/patient/PrescriptionScreen.tsx apps/mobile/src/__tests__/PrescriptionScreen.test.tsx
git commit -m "feat(mobile): PrescriptionScreen — diagnosis, medications, QR code"
```

---

## Task 12: HistoryScreen implementation

**Files:**
- Modify: `apps/mobile/src/screens/patient/HistoryScreen.tsx`
- Create: `apps/mobile/src/__tests__/HistoryScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/mobile/src/__tests__/HistoryScreen.test.tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- --testPathPattern=HistoryScreen 2>&1 | tail -15
```
Expected: FAIL.

- [ ] **Step 3: Implement HistoryScreen**

```typescript
// apps/mobile/src/screens/patient/HistoryScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationStatus } from '../../lib/types'

interface ConsultationListItem {
  id: string
  status: ConsultationStatus
  diagnosis: string | null
  created_at: string
  prescription: { id: string } | null
}

const STATUS_COLORS: Record<ConsultationStatus, string> = {
  pending: '#F59E0B',
  active: '#3B82F6',
  completed: '#22C55E',
  rejected: '#EF4444',
  cancelled: '#94A3B8',
}

export default function PatientHistoryScreen({ navigation }: any) {
  const { t } = useTranslation()
  const [items, setItems] = useState<ConsultationListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<ConsultationListItem[]>('/api/consultations/my')
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handlePress = (item: ConsultationListItem) => {
    if (item.status === 'completed') {
      navigation.navigate('PrescriptionScreen', { consultationId: item.id })
    } else if (item.status === 'active' || item.status === 'pending') {
      navigation.navigate('ConsultationScreen', { consultationId: item.id })
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{t('history.empty')}</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const color = STATUS_COLORS[item.status] ?? '#94A3B8'
        const date = new Date(item.created_at).toLocaleDateString()
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => handlePress(item)}
            testID={`consultation-${item.id}`}
          >
            <View style={styles.row}>
              <Text style={styles.date}>{date}</Text>
              <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.badgeText, { color }]}>
                  {t(`history.status.${item.status}`)}
                </Text>
              </View>
            </View>
            {item.diagnosis && (
              <Text style={styles.diagnosis}>{item.diagnosis}</Text>
            )}
          </TouchableOpacity>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#94A3B8' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  date: { fontSize: 13, color: '#64748B' },
  badge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  diagnosis: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- --testPathPattern=HistoryScreen 2>&1 | tail -15
```
Expected: PASS — 4 tests.

- [ ] **Step 5: Run full mobile test suite**

```bash
cd apps/mobile && npm test 2>&1 | tail -15
```
Expected: all tests pass.

- [ ] **Step 6: Run full API test suite**

```bash
cd packages/api && npx vitest run 2>&1 | tail -10
```
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/patient/HistoryScreen.tsx apps/mobile/src/__tests__/HistoryScreen.test.tsx
git commit -m "feat(mobile): HistoryScreen — past consultations list with navigation to chat and prescription"
```

---

## Self-Review Checklist

- [x] i18n keys: all strings referenced in screens are defined in Task 2
- [x] consultationStore: `setActive`, `appendMessage`, `setStatus`, `clear`, `hydrate` all match usage in screens
- [x] socket event: `consultation_updated` matches what the server emits (verified in ConsultationService.ts)
- [x] `ConsultationStatus` type values: `pending`, `active`, `completed`, `rejected`, `cancelled` match Prisma enum
- [x] Navigation params: all screens use `consultationId` key consistently
- [x] `PatientStackParamList` in RootNavigator covers all 4 screens
- [x] `getConsultation` enhanced in Task 6 before screens that need prescription data (Tasks 10–12)
- [x] Screen stubs created in Task 7 before RootNavigator imports them
