# Doctor Flow — Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement doctor-facing screens (queue, chat, prescription writing, history) and supporting API changes so doctors can receive, accept, chat with, and complete consultations.

**Architecture:** A new `DoctorStack` navigator (mirrors existing `PatientStack`) wraps `DoctorTabs` and adds `DoctorConsultationScreen` + `WriteRxScreen` as stack screens. The API gains `GET /consultations/queue` (doctor-only, returns all pending), a `new_consultation` socket event (broadcast to `doctors` room when patient submits), and doctor auto-join to `doctors` room on connect. All mobile screens follow the TDD pattern: jest-expo + @testing-library/react-native.

**Tech Stack:** React Native + Expo 52, React Navigation v7 (native-stack + bottom-tabs), Zustand 5, socket.io-client (existing singleton `socketService`), axios (existing `api` client), i18next, vitest + supertest (API), jest-expo (mobile)

---

## File Map

| Action | File |
|--------|------|
| MOD | `apps/mobile/src/i18n/es.json` |
| MOD | `apps/mobile/src/i18n/en.json` |
| MOD | `apps/mobile/src/lib/types.ts` |
| MOD | `packages/api/src/services/ConsultationService.ts` |
| MOD | `packages/api/src/routes/consultations.ts` |
| MOD | `packages/api/src/routes/consultations.test.ts` |
| MOD | `packages/api/src/sockets/consultation.ts` |
| NEW | `apps/mobile/src/navigation/DoctorStack.tsx` |
| MOD | `apps/mobile/src/navigation/RootNavigator.tsx` |
| MOD | `apps/mobile/src/screens/doctor/QueueScreen.tsx` |
| NEW | `apps/mobile/src/screens/doctor/DoctorConsultationScreen.tsx` |
| NEW | `apps/mobile/src/screens/doctor/WriteRxScreen.tsx` |
| MOD | `apps/mobile/src/screens/doctor/HistoryScreen.tsx` |
| NEW | `apps/mobile/src/__tests__/QueueScreen.test.tsx` |
| NEW | `apps/mobile/src/__tests__/DoctorConsultationScreen.test.tsx` |
| NEW | `apps/mobile/src/__tests__/WriteRxScreen.test.tsx` |
| NEW | `apps/mobile/src/__tests__/DoctorHistoryScreen.test.tsx` |

---

### Task 1: i18n keys

**Files:**
- Modify: `apps/mobile/src/i18n/es.json`
- Modify: `apps/mobile/src/i18n/en.json`

- [ ] **Step 1: Add queue and doctor keys to es.json**

In `apps/mobile/src/i18n/es.json`, add two new top-level sections after the `"history"` block (before the final `}`):

```json
  "queue": {
    "title": "Cola de consultas",
    "empty": "No hay consultas pendientes",
    "accept": "Aceptar",
    "reject": "Rechazar",
    "waiting_since": "Esperando"
  },
  "doctor": {
    "complete_cta": "Completar",
    "rx_title": "Completar consulta",
    "diagnosis_label": "Diagnóstico",
    "diagnosis_code_label": "Código CIE-10 (opcional)",
    "add_medication": "Agregar medicamento",
    "remove_medication": "Eliminar",
    "medication_name": "Nombre",
    "medication_dose": "Dosis",
    "medication_frequency": "Frecuencia",
    "instructions_label": "Instrucciones (opcional)",
    "price_label": "Precio en lempiras (opcional)",
    "submit_rx": "Completar y generar receta"
  }
```

- [ ] **Step 2: Add same keys to en.json**

In `apps/mobile/src/i18n/en.json`, add after the `"history"` block:

```json
  "queue": {
    "title": "Consultation Queue",
    "empty": "No pending consultations",
    "accept": "Accept",
    "reject": "Reject",
    "waiting_since": "Waiting"
  },
  "doctor": {
    "complete_cta": "Complete",
    "rx_title": "Complete consultation",
    "diagnosis_label": "Diagnosis",
    "diagnosis_code_label": "ICD-10 code (optional)",
    "add_medication": "Add medication",
    "remove_medication": "Remove",
    "medication_name": "Name",
    "medication_dose": "Dose",
    "medication_frequency": "Frequency",
    "instructions_label": "Instructions (optional)",
    "price_label": "Price in lempiras (optional)",
    "submit_rx": "Complete and generate prescription"
  }
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/i18n/es.json apps/mobile/src/i18n/en.json
git commit -m "feat(mobile): add doctor queue i18n keys (es + en)"
```

---

### Task 2: Mobile types — QueueItem

**Files:**
- Modify: `apps/mobile/src/lib/types.ts`

**Context:** The API's `GET /consultations/queue` includes the Prisma `patient` relation, which has a nested `user` relation. The phone lives at `patient.user.phone`. The mobile type must reflect this nesting.

- [ ] **Step 1: Add QueueItem to types.ts**

Append to `apps/mobile/src/lib/types.ts`:

```typescript
export interface QueueItem {
  id: string
  status: ConsultationStatus
  symptoms_text: string | null
  created_at: string
  patient: { user: { phone: string } }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/lib/types.ts
git commit -m "feat(mobile): add QueueItem type for doctor queue screen"
```

---

### Task 3: API — ConsultationService enhancements

Add `getPendingQueue()` and wire `new_consultation` socket emit into `createConsultation`.

**Files:**
- Modify: `packages/api/src/services/ConsultationService.ts`

**Context:** `ConsultationService` has `private io?: Server` injected via constructor (line 33). `createConsultation` currently returns `Promise<Consultation>` (line 36-43). The Prisma schema: `Consultation.patient_id` → `Patient.id`, `Patient.user` → `User.phone`. To get the phone without changing `createConsultation`'s return type, do a separate `db.patient.findUnique` query only when `this.io` is set.

- [ ] **Step 1: Add getPendingQueue method**

In `packages/api/src/services/ConsultationService.ts`, add after the `getUserConsultations` method (after line 157):

```typescript
async getPendingQueue() {
  return this.db.consultation.findMany({
    where: { status: ConsultationStatus.pending },
    include: { patient: { include: { user: { select: { phone: true } } } } },
    orderBy: { created_at: 'asc' },
  })
}
```

- [ ] **Step 2: Add new_consultation emit to createConsultation**

Replace the `createConsultation` method body (lines 36-43) with:

```typescript
async createConsultation(
  patientId: string,
  data: { symptoms_text?: string; symptom_photo?: string }
): Promise<Consultation> {
  const consultation = await this.db.consultation.create({
    data: { patient_id: patientId, symptoms_text: data.symptoms_text, symptom_photo: data.symptom_photo },
  })
  if (this.io) {
    const patient = await this.db.patient.findUnique({
      where: { id: patientId },
      include: { user: { select: { phone: true } } },
    })
    this.io.to('doctors').emit('new_consultation', {
      id: consultation.id,
      symptoms_text: consultation.symptoms_text,
      created_at: consultation.created_at,
      patient: { user: { phone: patient?.user.phone ?? '' } },
    })
  }
  return consultation
}
```

- [ ] **Step 3: Run existing API tests to verify nothing broke**

```bash
cd packages/api && npx vitest run 2>&1 | tail -6
```

Expected: all tests pass. The route tests mock `consultationService`, so the real `createConsultation` body is never called — no failures.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/services/ConsultationService.ts
git commit -m "feat(api): ConsultationService — getPendingQueue + new_consultation socket emit on create"
```

---

### Task 4: API — GET /consultations/queue route

**Files:**
- Modify: `packages/api/src/routes/consultations.ts`
- Modify: `packages/api/src/routes/consultations.test.ts`

**Context:** The route `/queue` must be registered before `/:id` to prevent Express matching the literal string "queue" as an id param. The `/my` route at line 70 already follows this pattern. `mockConsultationService` in the test file (line 26-35) needs `getPendingQueue: vi.fn()` added.

- [ ] **Step 1: Add getPendingQueue to mockConsultationService in test file**

In `packages/api/src/routes/consultations.test.ts`, update the `mockConsultationService` object to add `getPendingQueue`:

```typescript
const mockConsultationService = {
  createConsultation:   vi.fn(),
  getConsultation:      vi.fn(),
  acceptConsultation:   vi.fn(),
  rejectConsultation:   vi.fn(),
  cancelConsultation:   vi.fn(),
  completeConsultation: vi.fn(),
  confirmPayment:       vi.fn(),
  getUserConsultations: vi.fn(),
  getPendingQueue:      vi.fn(),
}
```

- [ ] **Step 2: Write failing tests for GET /queue**

Append to `packages/api/src/routes/consultations.test.ts`:

```typescript
describe('GET /api/consultations/queue', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).get('/api/consultations/queue')
    expect(res.status).toBe(401)
  })

  it('returns 403 for patient role', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/consultations/queue')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns pending consultations for doctor', async () => {
    mockConsultationService.getPendingQueue.mockResolvedValue([
      { ...baseConsultation, patient: { user: { phone: '+50412345678' } } },
    ])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/consultations/queue')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].status).toBe('pending')
    expect(mockConsultationService.getPendingQueue).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 3: Run tests to verify new ones fail**

```bash
cd packages/api && npx vitest run 2>&1 | grep -E "FAIL|queue" | head -10
```

Expected: 3 new failures for queue tests (route not yet registered).

- [ ] **Step 4: Add GET /queue route**

In `packages/api/src/routes/consultations.ts`, add after the `/my` route block and before the `/:id` route (around line 80):

```typescript
  // /queue MUST be before /:id to avoid Express treating "queue" as an id param
  router.get(
    '/queue',
    requireAuth,
    requireRole(Role.doctor),
    async (_req: Request, res: Response): Promise<void> => {
      const consultations = await consultationService.getPendingQueue()
      res.json(consultations)
    }
  )
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
cd packages/api && npx vitest run 2>&1 | tail -6
```

Expected: all tests pass including the 3 new queue tests.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/consultations.ts packages/api/src/routes/consultations.test.ts
git commit -m "feat(api): GET /consultations/queue — doctor-only pending consultation list"
```

---

### Task 5: API — Socket doctor auto-join

**Files:**
- Modify: `packages/api/src/sockets/consultation.ts`

**Context:** `registerConsultationHandlers` (line 6) sets `socket.data.user` from JWT in the `io.use` middleware (lines 7-17). The `io.on('connection', ...)` block starts at line 19. Adding `socket.join('doctors')` for doctor role inside the connection handler auto-enrolls doctors in the broadcast room — no client-side emit needed.

- [ ] **Step 1: Add doctor auto-join inside connection handler**

In `packages/api/src/sockets/consultation.ts`, add as the first line inside `io.on('connection', (socket: Socket) => {`:

```typescript
  io.on('connection', (socket: Socket) => {
    if (socket.data.user?.role === 'doctor') {
      socket.join('doctors')
    }

    socket.on('join_consultation', async ({ consultation_id }: { consultation_id: string }) => {
```

- [ ] **Step 2: Run API tests**

```bash
cd packages/api && npx vitest run 2>&1 | tail -6
```

Expected: all tests pass (socket layer is not unit tested; route tests are unaffected).

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/sockets/consultation.ts
git commit -m "feat(api): socket — auto-join doctors room on connect for new_consultation broadcasts"
```

---

### Task 6: DoctorStack navigation

**Files:**
- Create: `apps/mobile/src/navigation/DoctorStack.tsx`
- Create: `apps/mobile/src/screens/doctor/DoctorConsultationScreen.tsx` (stub)
- Create: `apps/mobile/src/screens/doctor/WriteRxScreen.tsx` (stub)
- Modify: `apps/mobile/src/navigation/RootNavigator.tsx`

**Context:** `RootNavigator.tsx` currently renders `<DoctorTabs />` directly for doctors (line 40: `if (role === 'doctor') return <DoctorTabs />`). Change to `<DoctorRoot />` from the new `DoctorStack.tsx`. Stubs must exist for `DoctorConsultationScreen` and `WriteRxScreen` so the navigator compiles — full implementations come in Tasks 7 and 8.

- [ ] **Step 1: Create stub DoctorConsultationScreen**

Create `apps/mobile/src/screens/doctor/DoctorConsultationScreen.tsx`:

```tsx
import React from 'react'
import { View, Text } from 'react-native'
export default function DoctorConsultationScreen() {
  return <View><Text>DoctorConsultationScreen</Text></View>
}
```

- [ ] **Step 2: Create stub WriteRxScreen**

Create `apps/mobile/src/screens/doctor/WriteRxScreen.tsx`:

```tsx
import React from 'react'
import { View, Text } from 'react-native'
export default function WriteRxScreen() {
  return <View><Text>WriteRxScreen</Text></View>
}
```

- [ ] **Step 3: Create DoctorStack.tsx**

Create `apps/mobile/src/navigation/DoctorStack.tsx`:

```tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import DoctorTabs from './DoctorTabs'
import DoctorConsultationScreen from '../screens/doctor/DoctorConsultationScreen'
import WriteRxScreen from '../screens/doctor/WriteRxScreen'

export type DoctorStackParamList = {
  DoctorTabs: undefined
  DoctorConsultationScreen: { consultationId: string }
  WriteRxScreen: { consultationId: string }
}

const Stack = createNativeStackNavigator<DoctorStackParamList>()

export default function DoctorRoot() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DoctorTabs" component={DoctorTabs} />
      <Stack.Screen
        name="DoctorConsultationScreen"
        component={DoctorConsultationScreen}
        options={{ headerShown: true, title: 'En consulta' }}
      />
      <Stack.Screen
        name="WriteRxScreen"
        component={WriteRxScreen}
        options={{ headerShown: true, title: 'Completar consulta' }}
      />
    </Stack.Navigator>
  )
}
```

- [ ] **Step 4: Update RootNavigator.tsx**

Replace the full content of `apps/mobile/src/navigation/RootNavigator.tsx`:

```tsx
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuthStore } from '../store/authStore'
import AuthStack from './AuthStack'
import PatientTabs from './PatientTabs'
import WaitingScreen from '../screens/patient/WaitingScreen'
import ConsultationScreen from '../screens/patient/ConsultationScreen'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'
import DoctorRoot from './DoctorStack'

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
  if (role === 'doctor') return <DoctorRoot />
  return <PatientRoot />
}
```

- [ ] **Step 5: Run existing mobile tests to verify no regressions**

```bash
cd apps/mobile && npx jest --no-coverage 2>&1 | tail -6
```

Expected: all existing tests pass (68 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/navigation/DoctorStack.tsx apps/mobile/src/navigation/RootNavigator.tsx apps/mobile/src/screens/doctor/DoctorConsultationScreen.tsx apps/mobile/src/screens/doctor/WriteRxScreen.tsx
git commit -m "feat(mobile): DoctorStack navigator — DoctorTabs + DoctorConsultationScreen + WriteRxScreen stubs"
```

---

### Task 7: QueueScreen

**Files:**
- Modify: `apps/mobile/src/screens/doctor/QueueScreen.tsx`
- Create: `apps/mobile/src/__tests__/QueueScreen.test.tsx`

**Context:** QueueScreen lives inside `DoctorTabs` (a bottom tab). It navigates to `DoctorConsultationScreen` — React Navigation bubbles navigate calls up through DoctorStack automatically (same pattern as patient HomeScreen navigating to WaitingScreen from PatientTabs).

`QueueItem` type (added in Task 2): `{ id, status, symptoms_text, created_at, patient: { user: { phone } } }`.

Phone masking: show last 4 digits, pad rest with `•`. E.g. `+50412345678` → `••••••••5678`.

Socket events: `new_consultation` (prepend to list), `consultation_updated` (remove from list if status !== 'pending').

`useAuthStore` is called with a selector: `useAuthStore((s) => s.token)`. Mock as `jest.fn((selector) => selector({ token: 'tok' }))`.

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/QueueScreen.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import QueueScreen from '../screens/doctor/QueueScreen'
import api from '../lib/api'
import { socketService } from '../lib/socket'
import { useAuthStore } from '../store/authStore'

jest.mock('../lib/api', () => ({ default: { get: jest.fn(), put: jest.fn() } }))
jest.mock('../lib/socket', () => ({
  socketService: { connect: jest.fn(), emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
jest.mock('../store/authStore', () => ({ useAuthStore: jest.fn() }))

const mockGet = api.get as jest.Mock
const mockPut = api.put as jest.Mock
const mockAuthStore = useAuthStore as jest.Mock

const queueItem = {
  id: 'c-1',
  status: 'pending',
  symptoms_text: 'headache for 3 days',
  created_at: new Date().toISOString(),
  patient: { user: { phone: '+50412345678' } },
}

const navigation = { navigate: jest.fn(), goBack: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthStore.mockImplementation((selector: any) => selector({ token: 'tok' }))
  mockGet.mockResolvedValue({ data: [queueItem] })
})

describe('QueueScreen', () => {
  it('renders pending consultation card', async () => {
    const { getByTestId } = render(<QueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByTestId('queue-item-c-1')).toBeTruthy()
    })
  })

  it('renders empty state when queue is empty', async () => {
    mockGet.mockResolvedValue({ data: [] })
    const { getByText } = render(<QueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByText('queue.empty')).toBeTruthy()
    })
  })

  it('accept button calls PUT accept and navigates to DoctorConsultationScreen', async () => {
    mockPut.mockResolvedValue({})
    const { getByTestId } = render(<QueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('queue-item-c-1')).toBeTruthy() })
    fireEvent.press(getByTestId('accept-c-1'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/consultations/c-1/accept')
      expect(navigation.navigate).toHaveBeenCalledWith('DoctorConsultationScreen', { consultationId: 'c-1' })
    })
  })

  it('reject button calls PUT reject and removes card from list', async () => {
    mockPut.mockResolvedValue({})
    const { getByTestId, queryByTestId } = render(<QueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('queue-item-c-1')).toBeTruthy() })
    fireEvent.press(getByTestId('reject-c-1'))
    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/api/consultations/c-1/reject')
      expect(queryByTestId('queue-item-c-1')).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/mobile && npx jest --testPathPattern="QueueScreen" --no-coverage 2>&1 | tail -8
```

Expected: 4 failures.

- [ ] **Step 3: Implement QueueScreen**

Replace `apps/mobile/src/screens/doctor/QueueScreen.tsx`:

```tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import type { QueueItem } from '../../lib/types'

function timeAgo(isoString: string): string {
  const mins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60_000)
  if (mins < 1) return '< 1 min'
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h`
}

export default function QueueScreen({ navigation }: any) {
  const { t } = useTranslation()
  const token = useAuthStore((s: any) => s.token)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const [items, setItems] = useState<QueueItem[]>([])
  const [loading, setLoading] = useState(true)

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  useEffect(() => {
    api.get<QueueItem[]>('/api/consultations/queue')
      .then(({ data }) => setItems(data))
      .catch(() => {})
      .finally(() => setLoading(false))

    socketService.connect(baseURL, token ?? '')

    const handleNew = (item: QueueItem) => setItems((prev) => [item, ...prev])
    const handleUpdated = (data: { id: string; status: string }) => {
      if (data.status !== 'pending') removeItem(data.id)
    }

    socketService.on('new_consultation', handleNew)
    socketService.on('consultation_updated', handleUpdated)

    return () => {
      socketService.off('new_consultation', handleNew)
      socketService.off('consultation_updated', handleUpdated)
    }
  }, [baseURL, token, removeItem])

  const handleAccept = async (item: QueueItem) => {
    try {
      await api.put(`/api/consultations/${item.id}/accept`)
      removeItem(item.id)
      navigation.navigate('DoctorConsultationScreen', { consultationId: item.id })
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }

  const handleReject = async (item: QueueItem) => {
    try {
      await api.put(`/api/consultations/${item.id}/reject`)
      removeItem(item.id)
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
  }

  if (items.length === 0) {
    return <View style={styles.center}><Text style={styles.emptyText}>{t('queue.empty')}</Text></View>
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const phone = item.patient.user.phone
        const masked = phone.slice(-4).padStart(phone.length, '•')
        return (
          <View style={styles.card} testID={`queue-item-${item.id}`}>
            <Text style={styles.phone}>{masked}</Text>
            {item.symptoms_text && (
              <Text style={styles.symptoms} numberOfLines={3}>{item.symptoms_text}</Text>
            )}
            <Text style={styles.time}>{t('queue.waiting_since')}: {timeAgo(item.created_at)}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => handleAccept(item)}
                testID={`accept-${item.id}`}
              >
                <Text style={styles.acceptText}>{t('queue.accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleReject(item)}
                testID={`reject-${item.id}`}
              >
                <Text style={styles.rejectText}>{t('queue.reject')}</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0',
  },
  phone: { fontSize: 13, color: '#64748B', marginBottom: 6 },
  symptoms: { fontSize: 15, color: '#1E293B', marginBottom: 8 },
  time: { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  acceptBtn: {
    flex: 1, backgroundColor: '#3B82F6', borderRadius: 8,
    padding: 10, alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '700' },
  rejectBtn: {
    flex: 1, borderWidth: 1, borderColor: '#EF4444',
    borderRadius: 8, padding: 10, alignItems: 'center',
  },
  rejectText: { color: '#EF4444', fontWeight: '600' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npx jest --testPathPattern="QueueScreen" --no-coverage 2>&1 | tail -8
```

Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/doctor/QueueScreen.tsx apps/mobile/src/__tests__/QueueScreen.test.tsx
git commit -m "feat(mobile): QueueScreen — pending list with accept/reject and real-time socket updates"
```

---

### Task 8: DoctorConsultationScreen

**Files:**
- Modify: `apps/mobile/src/screens/doctor/DoctorConsultationScreen.tsx`
- Create: `apps/mobile/src/__tests__/DoctorConsultationScreen.test.tsx`

**Context:** Doctor's chat view. Mirrors patient `ConsultationScreen` but: no prescription card (doctor writes it), has a "Completar" button at top → navigates to `WriteRxScreen`. When `consultation_updated(completed)` arrives, button hides and input disables.

`useAuthStore` is called with selectors for both `token` and `userId`. Mock: `jest.fn((selector) => selector({ token: 'tok', userId: 'doc-1' }))`.

`useConsultationStore` returns `{ messages, status, appendMessage, setStatus }`. Mock: `jest.fn(() => ({ messages: [], status: 'active', appendMessage: jest.fn(), setStatus: jest.fn() }))`.

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/DoctorConsultationScreen.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import DoctorConsultationScreen from '../screens/doctor/DoctorConsultationScreen'
import api from '../lib/api'
import { socketService } from '../lib/socket'
import { useAuthStore } from '../store/authStore'
import { useConsultationStore } from '../store/consultationStore'

jest.mock('../lib/api', () => ({ default: { get: jest.fn() } }))
jest.mock('../lib/socket', () => ({
  socketService: { connect: jest.fn(), emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
jest.mock('../store/authStore', () => ({ useAuthStore: jest.fn() }))
jest.mock('../store/consultationStore', () => ({ useConsultationStore: jest.fn() }))

const mockGet = api.get as jest.Mock
const mockAuthStore = useAuthStore as jest.Mock
const mockConsultationStore = useConsultationStore as jest.Mock

const navigation = { navigate: jest.fn(), goBack: jest.fn() }
const route = { params: { consultationId: 'c-1' } }

beforeEach(() => {
  jest.clearAllMocks()
  mockAuthStore.mockImplementation((selector: any) => selector({ token: 'tok', userId: 'doc-1' }))
  mockConsultationStore.mockReturnValue({
    messages: [], status: 'active', appendMessage: jest.fn(), setStatus: jest.fn(),
  })
  mockGet.mockResolvedValue({ data: { status: 'active', messages: [], prescription: null } })
})

describe('DoctorConsultationScreen', () => {
  it('fetches consultation on mount', async () => {
    render(<DoctorConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/consultations/c-1')
    })
  })

  it('sends message via socket', async () => {
    const { getByTestId } = render(<DoctorConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalled() })
    fireEvent.changeText(getByTestId('chat-input'), 'hello patient')
    fireEvent.press(getByTestId('send-btn'))
    expect(socketService.emit).toHaveBeenCalledWith('send_message', expect.objectContaining({
      consultation_id: 'c-1',
      content: 'hello patient',
    }))
  })

  it('Completar button navigates to WriteRxScreen', async () => {
    const { getByTestId } = render(<DoctorConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalled() })
    fireEvent.press(getByTestId('complete-btn'))
    expect(navigation.navigate).toHaveBeenCalledWith('WriteRxScreen', { consultationId: 'c-1' })
  })

  it('input disabled and complete button hidden when status is completed', async () => {
    mockConsultationStore.mockReturnValue({
      messages: [], status: 'completed', appendMessage: jest.fn(), setStatus: jest.fn(),
    })
    const { getByTestId, queryByTestId } = render(<DoctorConsultationScreen navigation={navigation} route={route} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalled() })
    expect(getByTestId('chat-input').props.editable).toBe(false)
    expect(queryByTestId('complete-btn')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/mobile && npx jest --testPathPattern="DoctorConsultationScreen" --no-coverage 2>&1 | tail -8
```

Expected: 4 failures.

- [ ] **Step 3: Implement DoctorConsultationScreen**

Replace `apps/mobile/src/screens/doctor/DoctorConsultationScreen.tsx`:

```tsx
import React, { useEffect, useCallback, useRef, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { socketService } from '../../lib/socket'
import { useAuthStore } from '../../store/authStore'
import { useConsultationStore } from '../../store/consultationStore'
import type { ConsultationDetail, Message } from '../../lib/types'

export default function DoctorConsultationScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const token = useAuthStore((s: any) => s.token)
  const userId = useAuthStore((s: any) => s.userId)
  const baseURL = process.env.EXPO_PUBLIC_API_URL ?? ''
  const { messages, status, appendMessage, setStatus } = useConsultationStore()
  const [inputText, setInputText] = useState('')
  const listRef = useRef<FlatList>(null)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isCompleted = status === 'completed'

  const handleReceiveMessage = useCallback((msg: Message) => {
    appendMessage(msg)
    if (scrollTimer.current) clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100)
  }, [appendMessage])

  const handleConsultationUpdated = useCallback(async (data: { id: string; status: string }) => {
    if (data.id !== consultationId) return
    if (data.status === 'completed') await setStatus('completed')
  }, [consultationId, setStatus])

  useEffect(() => {
    socketService.connect(baseURL, token ?? '')
    socketService.emit('join_consultation', { consultation_id: consultationId })
    socketService.on('receive_message', handleReceiveMessage)
    socketService.on('consultation_updated', handleConsultationUpdated)

    api.get<ConsultationDetail & { messages: Message[] }>(`/api/consultations/${consultationId}`)
      .then(({ data }) => {
        data.messages?.forEach((m) => appendMessage(m))
        if (data.status === 'completed') setStatus('completed')
      })
      .catch(() => {})

    return () => {
      socketService.off('receive_message', handleReceiveMessage)
      socketService.off('consultation_updated', handleConsultationUpdated)
      if (scrollTimer.current) clearTimeout(scrollTimer.current)
    }
  }, [consultationId, handleReceiveMessage, handleConsultationUpdated, baseURL, token])

  const handleSend = () => {
    const content = inputText.trim()
    if (!content) return
    socketService.emit('send_message', { consultation_id: consultationId, content, msg_type: 'text' })
    setInputText('')
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!isCompleted && (
        <TouchableOpacity
          style={styles.completeBar}
          onPress={() => navigation.navigate('WriteRxScreen', { consultationId })}
          testID="complete-btn"
        >
          <Text style={styles.completeBarText}>{t('doctor.complete_cta')}</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const isMine = item.sender_id === userId
          return (
            <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
              <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
                {item.content}
              </Text>
            </View>
          )
        }}
        contentContainerStyle={styles.messageList}
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
  completeBar: {
    backgroundColor: '#22C55E', padding: 12, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#BBF7D0',
  },
  completeBarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  messageList: { padding: 16, paddingBottom: 8 },
  bubble: { maxWidth: '80%', borderRadius: 12, padding: 10, marginBottom: 8 },
  bubbleMine: { backgroundColor: '#EFF6FF', alignSelf: 'flex-end' },
  bubbleTheirs: { backgroundColor: '#F1F5F9', alignSelf: 'flex-start' },
  bubbleTextMine: { color: '#1D4ED8', fontSize: 15 },
  bubbleTextTheirs: { color: '#334155', fontSize: 15 },
  inputRow: {
    flexDirection: 'row', padding: 12, borderTopWidth: 1,
    borderTopColor: '#E2E8F0', gap: 8, alignItems: 'center',
  },
  input: { flex: 1, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, padding: 10, fontSize: 15 },
  inputDisabled: { backgroundColor: '#F1F5F9', color: '#94A3B8' },
  sendBtn: { backgroundColor: '#3B82F6', borderRadius: 10, padding: 10 },
  sendBtnDisabled: { backgroundColor: '#93C5FD' },
  sendBtnText: { color: '#fff', fontWeight: '700' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npx jest --testPathPattern="DoctorConsultationScreen" --no-coverage 2>&1 | tail -8
```

Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/doctor/DoctorConsultationScreen.tsx apps/mobile/src/__tests__/DoctorConsultationScreen.test.tsx
git commit -m "feat(mobile): DoctorConsultationScreen — real-time chat with complete button"
```

---

### Task 9: WriteRxScreen

**Files:**
- Modify: `apps/mobile/src/screens/doctor/WriteRxScreen.tsx`
- Create: `apps/mobile/src/__tests__/WriteRxScreen.test.tsx`

**Context:** Prescription form. Submit sends `PUT /api/consultations/:id/complete` with JSON body `{ diagnosis, diagnosis_code?, medications: [{name, dose, frequency}], instructions?, price_lps? }`. Server schema (`completeSchema` in `consultations.ts` line 17-28) requires `diagnosis` (string min 1) and `medications` (array). `price_lps` must be a number — convert from TextInput string via `parseFloat`.

Medications state: `useState<MedicationRow[]>([{ name: '', dose: '', frequency: '' }])`. MedicationRow is a local interface. Submit disabled until `diagnosis.trim()` is non-empty and at least one medication has `name` non-empty.

`api.put` sends JSON by default (axios). No `Content-Type` override needed.

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/WriteRxScreen.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import WriteRxScreen from '../screens/doctor/WriteRxScreen'
import api from '../lib/api'

jest.mock('../lib/api', () => ({ default: { put: jest.fn() } }))
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/mobile && npx jest --testPathPattern="WriteRxScreen" --no-coverage 2>&1 | tail -8
```

Expected: 4 failures.

- [ ] **Step 3: Implement WriteRxScreen**

Replace `apps/mobile/src/screens/doctor/WriteRxScreen.tsx`:

```tsx
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

interface MedicationRow {
  name: string
  dose: string
  frequency: string
}

export default function WriteRxScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }
  const [diagnosis, setDiagnosis] = useState('')
  const [diagnosisCode, setDiagnosisCode] = useState('')
  const [medications, setMedications] = useState<MedicationRow[]>([{ name: '', dose: '', frequency: '' }])
  const [instructions, setInstructions] = useState('')
  const [priceLps, setPriceLps] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = diagnosis.trim().length > 0 && medications.some((m) => m.name.trim().length > 0) && !submitting

  const updateMed = (index: number, field: keyof MedicationRow, value: string) => {
    setMedications((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m))
  }

  const addMedication = () => {
    setMedications((prev) => [...prev, { name: '', dose: '', frequency: '' }])
  }

  const removeMedication = (index: number) => {
    setMedications((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        diagnosis: diagnosis.trim(),
        medications: medications.filter((m) => m.name.trim().length > 0),
      }
      if (diagnosisCode.trim()) payload.diagnosis_code = diagnosisCode.trim()
      if (instructions.trim()) payload.instructions = instructions.trim()
      if (priceLps.trim()) payload.price_lps = parseFloat(priceLps)

      await api.put(`/api/consultations/${consultationId}/complete`, payload)
      navigation.goBack()
    } catch {
      Alert.alert(t('common.error_generic'))
      setSubmitting(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>{t('doctor.diagnosis_label')}</Text>
      <TextInput
        style={styles.input}
        value={diagnosis}
        onChangeText={setDiagnosis}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        testID="diagnosis-input"
      />

      <Text style={styles.label}>{t('doctor.diagnosis_code_label')}</Text>
      <TextInput
        style={styles.input}
        value={diagnosisCode}
        onChangeText={setDiagnosisCode}
        testID="diagnosis-code-input"
      />

      <Text style={styles.label}>{t('consultation.medications')}</Text>
      {medications.map((med, i) => (
        <View key={i} style={styles.medRow}>
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('doctor.medication_name')}
            value={med.name}
            onChangeText={(v) => updateMed(i, 'name', v)}
            testID={`med-name-${i}`}
          />
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('doctor.medication_dose')}
            value={med.dose}
            onChangeText={(v) => updateMed(i, 'dose', v)}
            testID={`med-dose-${i}`}
          />
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('doctor.medication_frequency')}
            value={med.frequency}
            onChangeText={(v) => updateMed(i, 'frequency', v)}
            testID={`med-freq-${i}`}
          />
          {medications.length > 1 && (
            <TouchableOpacity onPress={() => removeMedication(i)} testID={`remove-med-${i}`}>
              <Text style={styles.removeText}>{t('doctor.remove_medication')}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      <TouchableOpacity style={styles.addMedBtn} onPress={addMedication} testID="add-medication-btn">
        <Text style={styles.addMedText}>{t('doctor.add_medication')}</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{t('doctor.instructions_label')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={instructions}
        onChangeText={setInstructions}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        testID="instructions-input"
      />

      <Text style={styles.label}>{t('doctor.price_label')}</Text>
      <TextInput
        style={styles.input}
        value={priceLps}
        onChangeText={setPriceLps}
        keyboardType="numeric"
        testID="price-input"
      />

      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
        testID="submit-btn"
        accessibilityState={{ disabled: !canSubmit }}
      >
        {submitting
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.submitBtnText}>{t('doctor.submit_rx')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  label: {
    fontSize: 11, color: '#94A3B8', textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6, marginTop: 16, letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10,
    padding: 12, fontSize: 15, marginBottom: 4,
  },
  multiline: { minHeight: 80 },
  medRow: { marginBottom: 8 },
  medInput: { marginBottom: 4 },
  removeText: { color: '#EF4444', fontSize: 13, textAlign: 'right', marginBottom: 8 },
  addMedBtn: { marginTop: 4, marginBottom: 8 },
  addMedText: { color: '#3B82F6', fontSize: 14, fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#3B82F6', borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 24,
  },
  submitBtnDisabled: { backgroundColor: '#93C5FD' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npx jest --testPathPattern="WriteRxScreen" --no-coverage 2>&1 | tail -8
```

Expected: 4/4 pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/doctor/WriteRxScreen.tsx apps/mobile/src/__tests__/WriteRxScreen.test.tsx
git commit -m "feat(mobile): WriteRxScreen — dynamic prescription form with diagnosis and medications"
```

---

### Task 10: DoctorHistoryScreen

**Files:**
- Modify: `apps/mobile/src/screens/doctor/HistoryScreen.tsx`
- Create: `apps/mobile/src/__tests__/DoctorHistoryScreen.test.tsx`

**Context:** `GET /consultations/my` with doctor JWT returns consultations where `doctor_id = userId`. Response shape is `Consultation[]` — same Prisma model as patient history. Tap completed → `PrescriptionScreen` (reused from patient stack). Tap active/pending → `DoctorConsultationScreen`.

`STATUS_COLORS` and card pattern are identical to patient `HistoryScreen` — this is intentional duplication (YAGNI; they may diverge).

The test mock for `api.get` returns `ConsultationListItem[]`. `useAuthStore` not needed here (api client handles auth header via interceptor).

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/DoctorHistoryScreen.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import DoctorHistoryScreen from '../screens/doctor/HistoryScreen'
import api from '../lib/api'

jest.mock('../lib/api', () => ({ default: { get: jest.fn() } }))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const mockGet = api.get as jest.Mock
const navigation = { navigate: jest.fn() }

const completedItem = {
  id: 'c-1', status: 'completed', diagnosis: 'Pharyngitis',
  created_at: new Date().toISOString(), prescription: { id: 'rx-1' },
}
const activeItem = {
  id: 'c-2', status: 'active', diagnosis: null,
  created_at: new Date().toISOString(), prescription: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ data: [completedItem, activeItem] })
})

describe('DoctorHistoryScreen', () => {
  it('renders empty state when no consultations', async () => {
    mockGet.mockResolvedValue({ data: [] })
    const { getByText } = render(<DoctorHistoryScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByText('history.empty')).toBeTruthy() })
  })

  it('renders consultation cards', async () => {
    const { getByTestId } = render(<DoctorHistoryScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByTestId('consultation-c-1')).toBeTruthy()
      expect(getByTestId('consultation-c-2')).toBeTruthy()
    })
  })

  it('tapping completed consultation navigates to PrescriptionScreen', async () => {
    const { getByTestId } = render(<DoctorHistoryScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('consultation-c-1')).toBeTruthy() })
    fireEvent.press(getByTestId('consultation-c-1'))
    expect(navigation.navigate).toHaveBeenCalledWith('PrescriptionScreen', { consultationId: 'c-1' })
  })

  it('tapping active consultation navigates to DoctorConsultationScreen', async () => {
    const { getByTestId } = render(<DoctorHistoryScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('consultation-c-2')).toBeTruthy() })
    fireEvent.press(getByTestId('consultation-c-2'))
    expect(navigation.navigate).toHaveBeenCalledWith('DoctorConsultationScreen', { consultationId: 'c-2' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd apps/mobile && npx jest --testPathPattern="DoctorHistoryScreen" --no-coverage 2>&1 | tail -8
```

Expected: 4 failures.

- [ ] **Step 3: Implement DoctorHistoryScreen**

Replace `apps/mobile/src/screens/doctor/HistoryScreen.tsx`:

```tsx
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
  pending: '#F59E0B', active: '#3B82F6', completed: '#22C55E',
  rejected: '#EF4444', cancelled: '#94A3B8',
}

export default function DoctorHistoryScreen({ navigation }: any) {
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
      navigation.navigate('DoctorConsultationScreen', { consultationId: item.id })
    }
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
  }

  if (items.length === 0) {
    return <View style={styles.center}><Text style={styles.emptyText}>{t('history.empty')}</Text></View>
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const color = STATUS_COLORS[item.status] ?? '#94A3B8'
        const date = item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'
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
            {item.diagnosis && <Text style={styles.diagnosis}>{item.diagnosis}</Text>}
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
cd apps/mobile && npx jest --testPathPattern="DoctorHistoryScreen" --no-coverage 2>&1 | tail -8
```

Expected: 4/4 pass.

- [ ] **Step 5: Run the full test suite**

```bash
cd apps/mobile && npx jest --no-coverage 2>&1 | tail -6
```

Expected: all tests pass (existing 68 + new 16 = 84 total).

```bash
cd packages/api && npx vitest run 2>&1 | tail -6
```

Expected: all API tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/doctor/HistoryScreen.tsx apps/mobile/src/__tests__/DoctorHistoryScreen.test.tsx
git commit -m "feat(mobile): DoctorHistoryScreen — past consultations with navigation to chat and prescription"
```
