# Doctor Availability Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an availability toggle to a new `DoctorProfileScreen` so doctors can mark themselves available/unavailable for consultations.

**Architecture:** Add `GET /api/doctors/me` to the existing doctors router so the screen can read the doctor's current `available` state on mount. Create `DoctorProfileScreen` (new file) with a React Native `Switch` that calls `PUT /api/doctors/availability` on toggle with optimistic update + rollback. Swap `ProfileScreen` → `DoctorProfileScreen` in `DoctorTabs`.

**Tech Stack:** Express + Prisma (API), React Native + Zustand + jest-expo + @testing-library/react-native (mobile).

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| MOD | `packages/api/src/routes/doctors.ts` | Add `GET /doctors/me` |
| MOD | `packages/api/src/routes/doctors.test.ts` | Tests for new endpoint |
| MOD | `apps/mobile/src/i18n/es.json` | `doctor.availability_label` |
| MOD | `apps/mobile/src/i18n/en.json` | `doctor.availability_label` |
| NEW | `apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx` | Availability toggle + language + logout |
| NEW | `apps/mobile/src/__tests__/DoctorProfileScreen.test.tsx` | 4 test cases |
| MOD | `apps/mobile/src/navigation/DoctorTabs.tsx` | Swap to DoctorProfileScreen |

---

### Task 1: API — GET /api/doctors/me

**Files:**
- Modify: `packages/api/src/routes/doctors.ts`
- Modify: `packages/api/src/routes/doctors.test.ts`

#### Context

`packages/api/src/routes/doctors.ts` currently has:
- `GET /available` — lists all available approved doctors (no auth role check)
- `PUT /availability` — updates current doctor's available field (requires doctor role)

`mockDb.doctor.findUnique` is already declared in the test file (line 25) — no changes to the mock setup needed.

- [ ] **Step 1: Write failing tests**

Add inside `packages/api/src/routes/doctors.test.ts`, after the existing `describe` blocks:

```typescript
describe('GET /api/doctors/me', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).get('/api/doctors/me')
    expect(res.status).toBe(401)
  })

  it('returns 403 when caller is not a doctor', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/doctors/me')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns current doctor profile', async () => {
    mockDb.doctor.findUnique.mockResolvedValue(mockDoctor)
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/doctors/me')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(DOC_ID)
    expect(res.body.available).toBe(true)
    expect(mockDb.doctor.findUnique).toHaveBeenCalledWith({
      where:   { id: DOC_ID },
      include: { user: { select: { name: true, phone: true } } },
    })
  })

  it('returns 404 when doctor record not found', async () => {
    mockDb.doctor.findUnique.mockResolvedValue(null)
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/doctors/me')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm run test --workspace packages/api -- --reporter=verbose 2>&1 | tail -20
```

Expected: 4 new failures — "Cannot GET /api/doctors/me" or similar.

- [ ] **Step 3: Implement GET /doctors/me**

In `packages/api/src/routes/doctors.ts`, add the new route **before** the existing `router.get('/available', ...)` line:

```typescript
import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'

const availabilitySchema = z.object({ available: z.boolean() })

export function createDoctorsRouter(db: PrismaClient): Router {
  const router = Router()

  router.get(
    '/me',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const doctor = await db.doctor.findUnique({
        where:   { id: req.user!.sub },
        include: { user: { select: { name: true, phone: true } } },
      })
      if (!doctor) { res.status(404).json({ error: 'Doctor not found' }); return }
      res.json(doctor)
    }
  )

  router.get('/available', requireAuth, async (_req: Request, res: Response): Promise<void> => {
    const doctors = await db.doctor.findMany({
      where: {
        available:   true,
        approved_at: { not: null },
      },
      include: { user: { select: { name: true, phone: true } } },
    })
    res.json(doctors)
  })

  router.put(
    '/availability',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = availabilitySchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'available (boolean) is required' })
        return
      }
      const doctor = await db.doctor.update({
        where: { id: req.user!.sub },
        data:  { available: parsed.data.available },
      })
      res.json(doctor)
    }
  )

  return router
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
npm run test --workspace packages/api -- --reporter=verbose 2>&1 | tail -20
```

Expected: all tests pass (previously 4, now 8 in doctors.test.ts).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/doctors.ts packages/api/src/routes/doctors.test.ts
git commit -m "feat(api): add GET /doctors/me for current doctor profile"
```

---

### Task 2: i18n key + DoctorProfileScreen

**Files:**
- Modify: `apps/mobile/src/i18n/es.json`
- Modify: `apps/mobile/src/i18n/en.json`
- Create: `apps/mobile/src/__tests__/DoctorProfileScreen.test.tsx`
- Create: `apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx`

#### Context

The `"doctor"` key block already exists in both locale files. The screen uses:
- `api.get('/api/doctors/me')` on mount — returns `{ available: boolean, ... }`
- `api.put('/api/doctors/availability', { available: boolean })` on toggle
- `useAuthStore((s) => s.language)` / `useAuthStore((s) => s.setLanguage)` / `useAuthStore((s) => s.logout)`
- React Native `Switch` component (built-in, no extra install)

testIDs: `availability-switch`, `lang-es`, `lang-en`, `logout-btn`.

- [ ] **Step 1: Add i18n keys**

In `apps/mobile/src/i18n/es.json`, inside the `"doctor"` block, add:
```json
"availability_label": "Disponible para consultas"
```

In `apps/mobile/src/i18n/en.json`, inside the `"doctor"` block, add:
```json
"availability_label": "Available for consultations"
```

- [ ] **Step 2: Write failing tests**

Create `apps/mobile/src/__tests__/DoctorProfileScreen.test.tsx`:

```typescript
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
```

- [ ] **Step 3: Run tests to verify they fail**

```
npm test --workspace apps/mobile -- --testPathPattern=DoctorProfileScreen 2>&1 | tail -15
```

Expected: 4 failures — module not found for `DoctorProfileScreen`.

- [ ] **Step 4: Implement DoctorProfileScreen**

Create `apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react'
import {
  View, Text, Switch, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

export default function DoctorProfileScreen() {
  const { t } = useTranslation()
  const language   = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout     = useAuthStore((s) => s.logout)

  const [available, setAvailable] = useState(false)
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    api.get<{ available: boolean }>('/api/doctors/me')
      .then(({ data }) => setAvailable(data.available))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (value: boolean) => {
    const prev = available
    setAvailable(value)
    try {
      await api.put('/api/doctors/availability', { available: value })
    } catch {
      setAvailable(prev)
      Alert.alert(t('common.error_generic'))
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      {loading ? (
        <ActivityIndicator color="#3B82F6" style={styles.loader} />
      ) : (
        <View style={styles.row}>
          <Text style={styles.label}>{t('doctor.availability_label')}</Text>
          <Switch
            testID="availability-switch"
            value={available}
            onValueChange={handleToggle}
            trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
            thumbColor="#fff"
          />
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('profile.language')}</Text>
      <View style={styles.langRow}>
        <TouchableOpacity
          onPress={() => setLanguage('es')}
          style={[styles.langBtn, language === 'es' && styles.langBtnActive]}
          testID="lang-es"
        >
          <Text style={language === 'es' ? styles.langTextActive : styles.langText}>ES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setLanguage('en')}
          style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          testID="lang-en"
        >
          <Text style={language === 'en' ? styles.langTextActive : styles.langText}>EN</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="logout-btn">
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 24 },
  title:        { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  loader:       { marginBottom: 24 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  label:        { fontSize: 16, color: '#1E293B' },
  sectionLabel: { fontSize: 16, marginBottom: 8 },
  langRow:      { flexDirection: 'row', gap: 8, marginBottom: 32 },
  langBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6,
  },
  langBtnActive:  { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  langText:       { color: '#64748B', fontWeight: '500' },
  langTextActive: { color: '#3B82F6', fontWeight: '600' },
  logoutBtn: {
    marginTop: 'auto', padding: 14, backgroundColor: '#EF4444',
    borderRadius: 8, alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 5: Run tests to verify they pass**

```
npm test --workspace apps/mobile -- --testPathPattern=DoctorProfileScreen 2>&1 | tail -15
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/i18n/es.json apps/mobile/src/i18n/en.json
git add apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx
git add apps/mobile/src/__tests__/DoctorProfileScreen.test.tsx
git commit -m "feat(mobile): DoctorProfileScreen with availability toggle"
```

---

### Task 3: Wire up DoctorTabs + full test run

**Files:**
- Modify: `apps/mobile/src/navigation/DoctorTabs.tsx`

- [ ] **Step 1: Swap ProfileScreen → DoctorProfileScreen in DoctorTabs**

Replace the full content of `apps/mobile/src/navigation/DoctorTabs.tsx`:

```typescript
import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { useTranslation } from 'react-i18next'
import QueueScreen from '../screens/doctor/QueueScreen'
import DoctorHistoryScreen from '../screens/doctor/HistoryScreen'
import DoctorProfileScreen from '../screens/doctor/DoctorProfileScreen'

type DoctorTabsParamList = {
  Queue: undefined
  History: undefined
  Profile: undefined
}

const Tab = createBottomTabNavigator<DoctorTabsParamList>()

export default function DoctorTabs() {
  const { t } = useTranslation()
  return (
    <Tab.Navigator>
      <Tab.Screen name="Queue" component={QueueScreen} options={{ title: t('nav.queue') }} />
      <Tab.Screen name="History" component={DoctorHistoryScreen} options={{ title: t('nav.history') }} />
      <Tab.Screen name="Profile" component={DoctorProfileScreen} options={{ title: t('nav.profile') }} />
    </Tab.Navigator>
  )
}
```

- [ ] **Step 2: Run full mobile test suite**

```
npm test --workspace apps/mobile 2>&1 | tail -10
```

Expected: all test suites pass (16 total, 88 tests).

- [ ] **Step 3: Run full API test suite**

```
npm run test --workspace packages/api 2>&1 | tail -10
```

Expected: all 14 test files pass (124 tests — 120 existing + 4 new).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/DoctorTabs.tsx
git commit -m "feat(mobile): wire DoctorProfileScreen into DoctorTabs"
```
