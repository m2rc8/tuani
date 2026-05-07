# Brigade Mobile Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add offline-first brigade mode to the doctor mobile app — doctors join brigades, record consultations offline, and sync when connectivity returns.

**Architecture:** A Zustand `brigadeStore` persists offline consultations and the active brigade to AsyncStorage. Three new screens (`BrigadeHomeScreen`, `BrigadeQueueScreen`, `BrigadeConsultationScreen`) are added to `DoctorStack`. Two new API endpoints (`GET /api/brigades` list, `GET /api/brigades/by-code/:code`) and an extended seed response (adds `patients` array) support the mobile flow.

**Tech Stack:** React Native 0.76.5 / Expo 52, React Navigation native-stack, Zustand 5, AsyncStorage, axios, @react-native-community/netinfo, Vitest (API tests), jest-expo (mobile tests)

---

## File Map

| Action | File |
|--------|------|
| NEW | `apps/mobile/src/store/brigadeStore.ts` |
| NEW | `apps/mobile/src/__tests__/brigadeStore.test.ts` |
| MOD | `apps/mobile/src/lib/types.ts` |
| MOD | `apps/mobile/src/i18n/es.json` |
| MOD | `apps/mobile/src/App.tsx` |
| MOD | `apps/mobile/src/navigation/DoctorStack.tsx` |
| MOD | `apps/mobile/src/screens/doctor/QueueScreen.tsx` |
| NEW | `apps/mobile/src/screens/doctor/BrigadeHomeScreen.tsx` |
| NEW | `apps/mobile/src/__tests__/BrigadeHomeScreen.test.tsx` |
| NEW | `apps/mobile/src/screens/doctor/BrigadeQueueScreen.tsx` |
| NEW | `apps/mobile/src/__tests__/BrigadeQueueScreen.test.tsx` |
| NEW | `apps/mobile/src/screens/doctor/BrigadeConsultationScreen.tsx` |
| NEW | `apps/mobile/src/__tests__/BrigadeConsultationScreen.test.tsx` |
| MOD | `packages/api/src/services/BrigadeService.ts` |
| MOD | `packages/api/src/routes/brigades.ts` |
| MOD | `packages/api/src/routes/brigades.test.ts` |
| MOD | `packages/api/src/routes/sync.test.ts` |

---

### Task 1: Install NetInfo + setup mock

**Files:**
- Modify: `apps/mobile/package.json` (via expo install)
- Modify: `apps/mobile/src/__tests__/setup.ts`

- [ ] **Step 1: Install @react-native-community/netinfo**

Run from repo root:
```bash
cd apps/mobile && npx expo install @react-native-community/netinfo
```

Expected: package added to `package.json`, compatible version for Expo 52.

- [ ] **Step 2: Add NetInfo mock to setup.ts**

`apps/mobile/src/__tests__/setup.ts` — add at the bottom:

```typescript
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn().mockResolvedValue({ isConnected: false }),
  },
}))
```

Full file after edit:

```typescript
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  getItemAsync: jest.fn().mockResolvedValue(null),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}))

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es', languageTag: 'es-HN' }],
}))

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn().mockResolvedValue({ isConnected: false }),
  },
}))
```

- [ ] **Step 3: Run existing mobile tests to verify no regressions**

```bash
cd apps/mobile && npm test -- --passWithNoTests
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/__tests__/setup.ts
git commit -m "feat(mobile): install @react-native-community/netinfo"
```

---

### Task 2: Mobile types + i18n keys

**Files:**
- Modify: `apps/mobile/src/lib/types.ts`
- Modify: `apps/mobile/src/i18n/es.json`

- [ ] **Step 1: Add BrigadeInfo and OfflineConsultation to types.ts**

Append to `apps/mobile/src/lib/types.ts`:

```typescript
export interface BrigadeInfo {
  id: string
  name: string
  community: string
  status: 'active' | 'closed'
}

export interface OfflineConsultation {
  local_id: string
  patient_phone: string
  patient_name: string
  symptoms_text?: string
  diagnosis?: string
  medications: { name: string; dose: string; frequency: string }[]
  created_at: string
  synced: boolean
  sync_error?: string
}
```

- [ ] **Step 2: Add brigade namespace to es.json**

Add `"brigade"` key to `apps/mobile/src/i18n/es.json` (inside the root object, after the `"doctor"` block):

```json
"brigade": {
  "title": "Brigadas",
  "join_banner": "Unirse a una brigada →",
  "my_brigades": "Mis brigadas",
  "enter": "Entrar",
  "join_section": "Unirse a una brigada",
  "join_code_placeholder": "Código (ej. ABC123)",
  "search": "Buscar brigada",
  "preview_title": "¿Unirse a esta brigada?",
  "confirm_join": "Unirse",
  "cancel": "Cancelar",
  "new_consultation": "+ Nueva consulta",
  "sync": "↑ Sync",
  "pending_count": "{{count}} sin sync",
  "synced_count": "{{count}} synced",
  "draft": "borrador",
  "synced": "syncronizado",
  "save_offline": "Guardar (offline)",
  "will_sync": "Se sincronizará automáticamente con conexión",
  "leave": "← Salir de brigada",
  "patient_phone": "Teléfono",
  "patient_name": "Nombre",
  "symptoms": "Síntomas",
  "diagnosis": "Diagnóstico",
  "medications": "Medicamentos",
  "add_medication": "+ Agregar medicamento",
  "remove_medication": "Eliminar",
  "med_name": "Nombre",
  "med_dose": "Dosis",
  "med_frequency": "Frecuencia",
  "error_required": "Teléfono y nombre son requeridos",
  "error_code_not_found": "Código de brigada no encontrado"
}
```

- [ ] **Step 3: Run mobile tests to confirm no breakage**

```bash
cd apps/mobile && npm test -- --passWithNoTests
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/lib/types.ts apps/mobile/src/i18n/es.json
git commit -m "feat(mobile): brigade types and i18n keys"
```

---

### Task 3: brigadeStore + App.tsx hydration + tests

**Files:**
- Create: `apps/mobile/src/store/brigadeStore.ts`
- Create: `apps/mobile/src/__tests__/brigadeStore.test.ts`
- Modify: `apps/mobile/src/App.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/__tests__/brigadeStore.test.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useBrigadeStore } from '../store/brigadeStore'
import type { BrigadeInfo, OfflineConsultation } from '../lib/types'

const brigade: BrigadeInfo = { id: 'b1', name: 'Brigada Norte', community: 'Comunidad X', status: 'active' }
const patients = [{ phone: '+50499111111', name: 'María' }]

const baseItem: Omit<OfflineConsultation, 'local_id' | 'synced' | 'sync_error'> = {
  patient_phone: '+50499111111',
  patient_name: 'María López',
  medications: [],
  created_at: '2026-05-06T10:00:00Z',
}

const STORAGE_KEY = 'brigade_store'

beforeEach(async () => {
  useBrigadeStore.setState({
    activeBrigade: null,
    brigades: [],
    patientCache: [],
    offlineQueue: [],
    syncState: 'idle',
    lastSyncedAt: null,
  })
  await AsyncStorage.clear()
  jest.clearAllMocks()
})

describe('setActiveBrigade', () => {
  it('sets activeBrigade and patientCache in state', async () => {
    await useBrigadeStore.getState().setActiveBrigade(brigade, patients)
    expect(useBrigadeStore.getState().activeBrigade).toEqual(brigade)
    expect(useBrigadeStore.getState().patientCache).toEqual(patients)
  })

  it('persists to AsyncStorage', async () => {
    await useBrigadeStore.getState().setActiveBrigade(brigade, patients)
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed.activeBrigade.id).toBe('b1')
    expect(parsed.patientCache).toHaveLength(1)
  })
})

describe('clearActiveBrigade', () => {
  it('nulls activeBrigade and empties patientCache', async () => {
    await useBrigadeStore.getState().setActiveBrigade(brigade, patients)
    await useBrigadeStore.getState().clearActiveBrigade()
    expect(useBrigadeStore.getState().activeBrigade).toBeNull()
    expect(useBrigadeStore.getState().patientCache).toHaveLength(0)
  })
})

describe('addConsultation', () => {
  it('adds item to offlineQueue and returns local_id', () => {
    const local_id = useBrigadeStore.getState().addConsultation(baseItem)
    expect(typeof local_id).toBe('string')
    expect(local_id.length).toBeGreaterThan(0)
    const queue = useBrigadeStore.getState().offlineQueue
    expect(queue).toHaveLength(1)
    expect(queue[0].local_id).toBe(local_id)
    expect(queue[0].synced).toBe(false)
    expect(queue[0].patient_name).toBe('María López')
  })

  it('prepends new item to existing queue', () => {
    useBrigadeStore.getState().addConsultation(baseItem)
    useBrigadeStore.getState().addConsultation({ ...baseItem, patient_name: 'Juan' })
    const queue = useBrigadeStore.getState().offlineQueue
    expect(queue[0].patient_name).toBe('Juan')
    expect(queue).toHaveLength(2)
  })
})

describe('markSynced', () => {
  it('flips synced flag for matching local_ids', async () => {
    useBrigadeStore.getState().addConsultation(baseItem)
    const queue = useBrigadeStore.getState().offlineQueue
    const local_id = queue[0].local_id
    await useBrigadeStore.getState().markSynced([local_id])
    expect(useBrigadeStore.getState().offlineQueue[0].synced).toBe(true)
  })

  it('leaves unmatched items untouched', async () => {
    useBrigadeStore.getState().addConsultation(baseItem)
    await useBrigadeStore.getState().markSynced(['nonexistent'])
    expect(useBrigadeStore.getState().offlineQueue[0].synced).toBe(false)
  })
})

describe('markRejected', () => {
  it('sets sync_error on matching items without marking as synced', async () => {
    useBrigadeStore.getState().addConsultation(baseItem)
    const local_id = useBrigadeStore.getState().offlineQueue[0].local_id
    await useBrigadeStore.getState().markRejected([{ local_id, reason: 'DB error' }])
    const item = useBrigadeStore.getState().offlineQueue[0]
    expect(item.sync_error).toBe('DB error')
    expect(item.synced).toBe(false)
  })
})

describe('hydrate', () => {
  it('restores activeBrigade and offlineQueue from AsyncStorage', async () => {
    const stored = {
      activeBrigade: brigade,
      patientCache: patients,
      offlineQueue: [{ ...baseItem, local_id: 'x1', synced: false }],
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
    await useBrigadeStore.getState().hydrate()
    expect(useBrigadeStore.getState().activeBrigade?.id).toBe('b1')
    expect(useBrigadeStore.getState().offlineQueue).toHaveLength(1)
  })

  it('does nothing when storage is empty', async () => {
    await useBrigadeStore.getState().hydrate()
    expect(useBrigadeStore.getState().activeBrigade).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- brigadeStore --passWithNoTests
```

Expected: FAIL — `Cannot find module '../store/brigadeStore'`

- [ ] **Step 3: Implement brigadeStore**

Create `apps/mobile/src/store/brigadeStore.ts`:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import type { BrigadeInfo, OfflineConsultation } from '../lib/types'

const STORAGE_KEY = 'brigade_store'

interface PersistedState {
  activeBrigade: BrigadeInfo | null
  patientCache: { phone: string; name: string }[]
  offlineQueue: OfflineConsultation[]
}

interface BrigadeState {
  activeBrigade: BrigadeInfo | null
  brigades: BrigadeInfo[]
  patientCache: { phone: string; name: string }[]
  offlineQueue: OfflineConsultation[]
  syncState: 'idle' | 'syncing' | 'error'
  lastSyncedAt: string | null

  setActiveBrigade: (brigade: BrigadeInfo, patients: { phone: string; name: string }[]) => Promise<void>
  clearActiveBrigade: () => Promise<void>
  setBrigades: (brigades: BrigadeInfo[]) => void
  addConsultation: (c: Omit<OfflineConsultation, 'local_id' | 'synced' | 'sync_error'>) => string
  markSynced: (local_ids: string[]) => Promise<void>
  markRejected: (items: { local_id: string; reason: string }[]) => Promise<void>
  setSyncState: (state: 'idle' | 'syncing' | 'error') => void
  setLastSyncedAt: (at: string) => void
  hydrate: () => Promise<void>
}

async function persist(state: PersistedState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export const useBrigadeStore = create<BrigadeState>((set, get) => ({
  activeBrigade: null,
  brigades: [],
  patientCache: [],
  offlineQueue: [],
  syncState: 'idle',
  lastSyncedAt: null,

  setActiveBrigade: async (brigade, patients) => {
    const { offlineQueue } = get()
    await persist({ activeBrigade: brigade, patientCache: patients, offlineQueue })
    set({ activeBrigade: brigade, patientCache: patients })
  },

  clearActiveBrigade: async () => {
    const { offlineQueue } = get()
    await persist({ activeBrigade: null, patientCache: [], offlineQueue })
    set({ activeBrigade: null, patientCache: [] })
  },

  setBrigades: (brigades) => set({ brigades }),

  addConsultation: (c) => {
    const local_id = Math.random().toString(36).slice(2) + Date.now().toString(36)
    const item: OfflineConsultation = { ...c, local_id, synced: false }
    const newQueue = [item, ...get().offlineQueue]
    set({ offlineQueue: newQueue })
    const { activeBrigade, patientCache } = get()
    persist({ activeBrigade, patientCache, offlineQueue: newQueue }).catch(() => {})
    return local_id
  },

  markSynced: async (local_ids) => {
    const idSet = new Set(local_ids)
    const { activeBrigade, patientCache } = get()
    const newQueue = get().offlineQueue.map(c =>
      idSet.has(c.local_id) ? { ...c, synced: true, sync_error: undefined } : c
    )
    await persist({ activeBrigade, patientCache, offlineQueue: newQueue })
    set({ offlineQueue: newQueue })
  },

  markRejected: async (items) => {
    const errMap = new Map(items.map(i => [i.local_id, i.reason]))
    const { activeBrigade, patientCache } = get()
    const newQueue = get().offlineQueue.map(c =>
      errMap.has(c.local_id) ? { ...c, sync_error: errMap.get(c.local_id) } : c
    )
    await persist({ activeBrigade, patientCache, offlineQueue: newQueue })
    set({ offlineQueue: newQueue })
  },

  setSyncState: (syncState) => set({ syncState }),

  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const { activeBrigade, patientCache, offlineQueue }: PersistedState = JSON.parse(raw)
    set({ activeBrigade, patientCache, offlineQueue })
  },
}))
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/mobile && npm test -- brigadeStore
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Add brigadeStore hydration to App.tsx**

In `apps/mobile/src/App.tsx`, add import and hydration call:

```typescript
import { useBrigadeStore } from './store/brigadeStore'
```

Inside the `init` function (after `await hydrate()`):

```typescript
await useBrigadeStore.getState().hydrate()
```

Full `init` function after edit:

```typescript
async function init() {
  try {
    await hydrate()
    await i18n.changeLanguage(useAuthStore.getState().language)
    if (useAuthStore.getState().role) {
      registerForPushNotifications().catch(() => {})
    }
    await useBrigadeStore.getState().hydrate()
  } finally {
    setReady(true)
  }
}
```

- [ ] **Step 6: Run full mobile test suite**

```bash
cd apps/mobile && npm test -- --passWithNoTests
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/store/brigadeStore.ts apps/mobile/src/__tests__/brigadeStore.test.ts apps/mobile/src/App.tsx
git commit -m "feat(mobile): brigadeStore with offline queue persistence"
```

---

### Task 4: API — list brigades + by-code endpoints

**Files:**
- Modify: `packages/api/src/services/BrigadeService.ts`
- Modify: `packages/api/src/routes/brigades.ts`
- Modify: `packages/api/src/routes/brigades.test.ts`

- [ ] **Step 1: Write 4 failing tests in brigades.test.ts**

Add to `packages/api/src/routes/brigades.test.ts`:

First, add `findMany` and `findFirst` to `mockDb`:

```typescript
const mockDb = {
  brigade: {
    create:     vi.fn(),
    findUnique: vi.fn(),
    findFirst:  vi.fn(),   // add this
  },
  brigadeDoctor: {
    findUnique: vi.fn(),
    create:     vi.fn(),
    findMany:   vi.fn(),   // add this
  },
  consultation: {
    count:    vi.fn(),
    findMany: vi.fn(),
    groupBy:  vi.fn(),
  },
  patient: {
    count: vi.fn(),
  },
}
```

Then append these test blocks at the end of the file:

```typescript
// --- GET / (list mine) ---

describe('GET /api/brigades', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).get('/api/brigades')
    expect(res.status).toBe(401)
  })

  it('returns brigade list for doctor', async () => {
    mockDb.brigadeDoctor.findMany.mockResolvedValue([
      {
        brigade_id: BRIGADE_ID,
        doctor_id:  DOC_ID,
        joined_at:  new Date('2026-05-06'),
        brigade:    { id: BRIGADE_ID, name: 'Brigada Norte', community: 'Comunidad X', status: 'active' },
      },
    ])
    const res = await request(makeTestApp())
      .get('/api/brigades')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(BRIGADE_ID)
    expect(res.body[0].name).toBe('Brigada Norte')
  })
})

// --- GET /by-code/:code ---

describe('GET /api/brigades/by-code/:code', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp()).get('/api/brigades/by-code/ABC123')
    expect(res.status).toBe(401)
  })

  it('returns 200 with brigade info when code exists', async () => {
    mockDb.brigade.findFirst.mockResolvedValue({
      id: BRIGADE_ID, name: 'Brigada Norte', community: 'Comunidad X',
      municipality: null, department: null, status: 'active',
      start_date: new Date('2026-05-10'), end_date: new Date('2026-05-12'),
    })
    const res = await request(makeTestApp())
      .get('/api/brigades/by-code/ABC123')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(BRIGADE_ID)
    expect(res.body.name).toBe('Brigada Norte')
  })

  it('returns 404 when code does not exist', async () => {
    mockDb.brigade.findFirst.mockResolvedValue(null)
    const res = await request(makeTestApp())
      .get('/api/brigades/by-code/XXXXXX')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/api && npx vitest run --reporter=verbose src/routes/brigades.test.ts
```

Expected: 4 new tests FAIL (routes don't exist yet), existing 12 tests still pass.

- [ ] **Step 3: Add getMyBrigades and getBrigadeByCode to BrigadeService.ts**

Append these two methods to the `BrigadeService` class in `packages/api/src/services/BrigadeService.ts` (before the closing `}`):

```typescript
  async getMyBrigades(doctorId: string) {
    const rows = await this.db.brigadeDoctor.findMany({
      where:   { doctor_id: doctorId },
      include: { brigade: { select: { id: true, name: true, community: true, status: true } } },
      orderBy: { joined_at: 'desc' },
    })
    return rows.map(r => ({ ...r.brigade, joined_at: r.joined_at }))
  }

  async getBrigadeByCode(code: string) {
    return this.db.brigade.findFirst({
      where:  { join_code: code.toUpperCase() },
      select: {
        id: true, name: true, community: true, municipality: true,
        department: true, start_date: true, end_date: true, status: true,
      },
    })
  }
```

- [ ] **Step 4: Add GET / and GET /by-code/:code routes to brigades.ts**

In `packages/api/src/routes/brigades.ts`, insert two new routes BEFORE the existing `router.get('/:id', ...)`. The final router block order must be:

1. `POST /`
2. `GET /` ← new
3. `GET /by-code/:code` ← new
4. `GET /:id` ← existing (must stay after the above two)
5. `POST /:id/join`
6. `GET /:id/dashboard`
7. `GET /:id/report`

Insert after the `POST /` block and before `router.get('/:id', ...)`:

```typescript
  router.get(
    '/',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const brigades = await service.getMyBrigades(req.user!.sub)
        res.json(brigades)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/by-code/:code',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const brigade = await service.getBrigadeByCode(req.params.code)
        if (!brigade) { res.status(404).json({ error: 'Brigade not found' }); return }
        res.json(brigade)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
cd packages/api && npx vitest run --reporter=verbose src/routes/brigades.test.ts
```

Expected: all 16 tests PASS (12 existing + 4 new).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/services/BrigadeService.ts packages/api/src/routes/brigades.ts packages/api/src/routes/brigades.test.ts
git commit -m "feat(api): GET /brigades list-mine + GET /brigades/by-code/:code"
```

---

### Task 5: Extend getBrigadeSeed with patient cache

**Files:**
- Modify: `packages/api/src/services/BrigadeService.ts`
- Modify: `packages/api/src/routes/sync.test.ts`

- [ ] **Step 1: Update sync.test.ts seed test to assert patients**

In `packages/api/src/routes/sync.test.ts`:

1. Add `findMany: vi.fn()` to `consultation` in `mockDb`:

```typescript
const mockDb = {
  brigade: {
    findUnique: vi.fn(),
  },
  brigadeDoctor: {
    findUnique: vi.fn(),
  },
  user: {
    upsert: vi.fn(),
  },
  patient: {
    upsert: vi.fn(),
  },
  consultation: {
    create:   vi.fn(),
    findMany: vi.fn(),   // add this
  },
  prescription: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}
```

2. Update the existing `GET /api/sync/brigade/:id` test to mock `consultation.findMany` and assert `patients`:

Replace the existing `GET /api/sync/brigade/:id` describe block with:

```typescript
describe('GET /api/sync/brigade/:id', () => {
  it('returns 200 with brigade, doctor list, and patients for member', async () => {
    const brigadeId = 'brigade-uuid-1'
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: brigadeId, doctor_id: DOC_ID })
    mockDb.brigade.findUnique.mockResolvedValue({
      id:           brigadeId,
      name:         'Brigada Norte',
      community:    'Comunidad X',
      municipality: null,
      department:   null,
      start_date:   new Date('2026-05-10'),
      end_date:     new Date('2026-05-12'),
      status:       'active',
      doctors: [{ doctor_id: DOC_ID, doctor: { user: { name: 'Dr. Juan' } } }],
    })
    mockDb.consultation.findMany.mockResolvedValue([
      { patient: { user: { phone: '+50499111111', name: 'María' } } },
    ])
    const res = await request(makeTestApp())
      .get(`/api/sync/brigade/${brigadeId}`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.brigade.name).toBe('Brigada Norte')
    expect(res.body.doctors).toHaveLength(1)
    expect(res.body.doctors[0].id).toBe(DOC_ID)
    expect(res.body.patients).toHaveLength(1)
    expect(res.body.patients[0].phone).toBe('+50499111111')
    expect(res.body.patients[0].name).toBe('María')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/api && npx vitest run --reporter=verbose src/routes/sync.test.ts
```

Expected: `GET /api/sync/brigade/:id` test FAILS — `patients` not in response.

- [ ] **Step 3: Extend getBrigadeSeed in BrigadeService.ts**

Replace the existing `getBrigadeSeed` method with:

```typescript
  async getBrigadeSeed(brigadeId: string) {
    const brigade = await this.db.brigade.findUnique({
      where:   { id: brigadeId },
      include: {
        doctors: {
          include: { doctor: { include: { user: { select: { name: true } } } } },
        },
      },
    })
    if (!brigade) return null

    const consultationPatients = await this.db.consultation.findMany({
      where:   { brigade_id: brigadeId },
      select:  { patient: { select: { user: { select: { phone: true, name: true } } } } },
      orderBy: { synced_at: 'desc' },
      take:    500,
    })
    const seen = new Set<string>()
    const patients = consultationPatients
      .map(c => ({ phone: c.patient.user.phone, name: c.patient.user.name ?? '' }))
      .filter(p => { if (seen.has(p.phone)) return false; seen.add(p.phone); return true })

    return {
      brigade: {
        id:           brigade.id,
        name:         brigade.name,
        community:    brigade.community,
        municipality: brigade.municipality,
        department:   brigade.department,
        start_date:   brigade.start_date,
        end_date:     brigade.end_date,
        status:       brigade.status,
      },
      doctors:  brigade.doctors.map(bd => ({ id: bd.doctor_id, name: bd.doctor.user.name })),
      patients,
    }
  }
```

- [ ] **Step 4: Run all API tests to verify**

```bash
cd packages/api && npx vitest run
```

Expected: all 23 tests PASS (16 brigade + 7 sync).

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/BrigadeService.ts packages/api/src/routes/sync.test.ts
git commit -m "feat(api): extend brigade seed with patient cache"
```

---

### Task 6: DoctorStack navigation + QueueScreen banner

**Files:**
- Modify: `apps/mobile/src/navigation/DoctorStack.tsx`
- Modify: `apps/mobile/src/screens/doctor/QueueScreen.tsx`

- [ ] **Step 1: Add brigade screens to DoctorStackParamList and Stack.Navigator**

Replace `apps/mobile/src/navigation/DoctorStack.tsx` with:

```typescript
import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import DoctorTabs from './DoctorTabs'
import DoctorConsultationScreen from '../screens/doctor/DoctorConsultationScreen'
import WriteRxScreen from '../screens/doctor/WriteRxScreen'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'
import BrigadeHomeScreen from '../screens/doctor/BrigadeHomeScreen'
import BrigadeQueueScreen from '../screens/doctor/BrigadeQueueScreen'
import BrigadeConsultationScreen from '../screens/doctor/BrigadeConsultationScreen'

export type DoctorStackParamList = {
  DoctorTabs: undefined
  DoctorConsultationScreen: { consultationId: string }
  WriteRxScreen: { consultationId: string }
  PrescriptionScreen: { consultationId: string }
  BrigadeHomeScreen: undefined
  BrigadeQueueScreen: undefined
  BrigadeConsultationScreen: { local_id?: string }
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
      <Stack.Screen
        name="PrescriptionScreen"
        component={PrescriptionScreen}
        options={{ headerShown: true }}
      />
      <Stack.Screen
        name="BrigadeHomeScreen"
        component={BrigadeHomeScreen}
        options={{ headerShown: true, title: 'Brigadas' }}
      />
      <Stack.Screen
        name="BrigadeQueueScreen"
        component={BrigadeQueueScreen}
        options={{ headerShown: true, title: 'Brigada' }}
      />
      <Stack.Screen
        name="BrigadeConsultationScreen"
        component={BrigadeConsultationScreen}
        options={{ headerShown: true, title: 'Nueva consulta' }}
      />
    </Stack.Navigator>
  )
}
```

Note: `BrigadeHomeScreen`, `BrigadeQueueScreen`, `BrigadeConsultationScreen` files don't exist yet — create stub files now so the import doesn't break.

Create stub `apps/mobile/src/screens/doctor/BrigadeHomeScreen.tsx`:

```typescript
import React from 'react'
import { View, Text } from 'react-native'
export default function BrigadeHomeScreen() {
  return <View><Text>BrigadeHome</Text></View>
}
```

Create stub `apps/mobile/src/screens/doctor/BrigadeQueueScreen.tsx`:

```typescript
import React from 'react'
import { View, Text } from 'react-native'
export default function BrigadeQueueScreen() {
  return <View><Text>BrigadeQueue</Text></View>
}
```

Create stub `apps/mobile/src/screens/doctor/BrigadeConsultationScreen.tsx`:

```typescript
import React from 'react'
import { View, Text } from 'react-native'
export default function BrigadeConsultationScreen() {
  return <View><Text>BrigadeConsultation</Text></View>
}
```

- [ ] **Step 2: Add brigade banner to QueueScreen**

In `apps/mobile/src/screens/doctor/QueueScreen.tsx`, add the banner. The component currently returns either a spinner, empty state, or FlatList. Add the banner wrapped in a View at the top of all three cases.

Replace the `return` section (the FlatList return at the bottom) with a View that contains the banner + the FlatList:

```typescript
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

  const banner = (
    <TouchableOpacity
      style={styles.brigadeBanner}
      onPress={() => navigation.navigate('BrigadeHomeScreen')}
      testID="brigade-banner"
    >
      <Text style={styles.brigadeBannerText}>{t('brigade.join_banner')}</Text>
    </TouchableOpacity>
  )

  if (loading) {
    return (
      <View style={styles.flex}>
        {banner}
        <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
      </View>
    )
  }

  if (items.length === 0) {
    return (
      <View style={styles.flex}>
        {banner}
        <View style={styles.center}><Text style={styles.emptyText}>{t('queue.empty')}</Text></View>
      </View>
    )
  }

  return (
    <View style={styles.flex}>
      {banner}
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
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16, color: '#94A3B8' },
  list: { padding: 16 },
  brigadeBanner: {
    backgroundColor: '#EF4444',
    padding: 12,
    alignItems: 'center',
  },
  brigadeBannerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
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

- [ ] **Step 3: Run existing QueueScreen tests to confirm no regressions**

```bash
cd apps/mobile && npm test -- QueueScreen
```

Expected: all 4 existing QueueScreen tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/DoctorStack.tsx apps/mobile/src/screens/doctor/QueueScreen.tsx apps/mobile/src/screens/doctor/BrigadeHomeScreen.tsx apps/mobile/src/screens/doctor/BrigadeQueueScreen.tsx apps/mobile/src/screens/doctor/BrigadeConsultationScreen.tsx
git commit -m "feat(mobile): DoctorStack brigade screens + QueueScreen banner"
```

---

### Task 7: BrigadeHomeScreen + tests

**Files:**
- Modify: `apps/mobile/src/screens/doctor/BrigadeHomeScreen.tsx` (replace stub)
- Create: `apps/mobile/src/__tests__/BrigadeHomeScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/BrigadeHomeScreen.test.tsx`:

```typescript
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import BrigadeHomeScreen from '../screens/doctor/BrigadeHomeScreen'
import api from '../lib/api'
import { useBrigadeStore } from '../store/brigadeStore'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
jest.mock('../store/brigadeStore', () => {
  const actual = jest.requireActual('../store/brigadeStore')
  return actual
})

const mockGet = api.get as jest.Mock
const mockPost = api.post as jest.Mock

const navigation = { navigate: jest.fn(), goBack: jest.fn() }

const brigade = { id: 'b1', name: 'Brigada Norte', community: 'Comunidad X', status: 'active', joined_at: '2026-05-06T00:00:00Z' }
const seedResponse = {
  brigade: { id: 'b1', name: 'Brigada Norte', community: 'Comunidad X', status: 'active' },
  doctors: [{ id: 'd1', name: 'Dr. Juan' }],
  patients: [{ phone: '+50499111111', name: 'María' }],
}

beforeEach(() => {
  jest.clearAllMocks()
  useBrigadeStore.setState({ activeBrigade: null, brigades: [], patientCache: [], offlineQueue: [], syncState: 'idle', lastSyncedAt: null })
  mockGet.mockResolvedValue({ data: [brigade] })
})

describe('BrigadeHomeScreen', () => {
  it('renders brigade list from API on mount', async () => {
    const { getByText } = render(<BrigadeHomeScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByText('Brigada Norte')).toBeTruthy()
    })
    expect(mockGet).toHaveBeenCalledWith('/api/brigades')
  })

  it('Entrar button seeds brigade and navigates to BrigadeQueueScreen', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [brigade] })
      .mockResolvedValueOnce({ data: seedResponse })
    const { getByTestId } = render(<BrigadeHomeScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(getByTestId('enter-b1')).toBeTruthy() })
    await act(async () => { fireEvent.press(getByTestId('enter-b1')) })
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/sync/brigade/b1')
      expect(navigation.navigate).toHaveBeenCalledWith('BrigadeQueueScreen')
    })
  })

  it('join code search calls by-code endpoint and shows preview', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { id: 'b2', name: 'Brigada Sur', community: 'Sur' } })
    const { getByTestId, getByText } = render(<BrigadeHomeScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalledWith('/api/brigades') })
    fireEvent.changeText(getByTestId('join-code-input'), 'XYZ999')
    await act(async () => { fireEvent.press(getByTestId('search-btn')) })
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/api/brigades/by-code/XYZ999')
      expect(getByText('Brigada Sur')).toBeTruthy()
    })
  })

  it('confirm join POSTs to join endpoint then seeds and navigates', async () => {
    mockGet
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: { id: 'b2', name: 'Brigada Sur', community: 'Sur' } })
      .mockResolvedValueOnce({ data: seedResponse })
    mockPost.mockResolvedValue({})
    const { getByTestId } = render(<BrigadeHomeScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => { expect(mockGet).toHaveBeenCalledWith('/api/brigades') })
    fireEvent.changeText(getByTestId('join-code-input'), 'XYZ999')
    await act(async () => { fireEvent.press(getByTestId('search-btn')) })
    await waitFor(() => { expect(getByTestId('confirm-join-btn')).toBeTruthy() })
    await act(async () => { fireEvent.press(getByTestId('confirm-join-btn')) })
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/brigades/b2/join', { join_code: 'XYZ999' })
      expect(navigation.navigate).toHaveBeenCalledWith('BrigadeQueueScreen')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- BrigadeHomeScreen
```

Expected: FAIL — stub component doesn't have expected behavior.

- [ ] **Step 3: Implement BrigadeHomeScreen**

Replace `apps/mobile/src/screens/doctor/BrigadeHomeScreen.tsx` with the full implementation:

```typescript
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useBrigadeStore } from '../../store/brigadeStore'
import type { BrigadeInfo } from '../../lib/types'

interface BrigadeListItem extends BrigadeInfo {
  joined_at: string
}

export default function BrigadeHomeScreen({ navigation }: any) {
  const { t } = useTranslation()
  const { setBrigades, setActiveBrigade } = useBrigadeStore()
  const [brigades, setBrigadesLocal] = useState<BrigadeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [joinCode, setJoinCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [preview, setPreview] = useState<{ id: string; name: string; community: string } | null>(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    api.get<BrigadeListItem[]>('/api/brigades')
      .then(({ data }) => {
        setBrigadesLocal(data)
        setBrigades(data.map(b => ({ id: b.id, name: b.name, community: b.community, status: b.status })))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [setBrigades])

  const handleEnter = useCallback(async (brigadeId: string) => {
    try {
      const { data } = await api.get<{ brigade: BrigadeInfo; doctors: any[]; patients: { phone: string; name: string }[] }>(
        `/api/sync/brigade/${brigadeId}`
      )
      await setActiveBrigade(data.brigade, data.patients)
      navigation.navigate('BrigadeQueueScreen')
    } catch {
      Alert.alert(t('common.error_generic'))
    }
  }, [navigation, setActiveBrigade, t])

  const handleSearch = useCallback(async () => {
    if (joinCode.length !== 6) return
    setSearching(true)
    setPreview(null)
    try {
      const { data } = await api.get<{ id: string; name: string; community: string }>(
        `/api/brigades/by-code/${joinCode.toUpperCase()}`
      )
      setPreview(data)
    } catch {
      Alert.alert(t('brigade.error_code_not_found'))
    } finally {
      setSearching(false)
    }
  }, [joinCode, t])

  const handleJoin = useCallback(async () => {
    if (!preview) return
    setJoining(true)
    try {
      await api.post(`/api/brigades/${preview.id}/join`, { join_code: joinCode.toUpperCase() })
      const { data } = await api.get<{ brigade: BrigadeInfo; doctors: any[]; patients: { phone: string; name: string }[] }>(
        `/api/sync/brigade/${preview.id}`
      )
      await setActiveBrigade(data.brigade, data.patients)
      navigation.navigate('BrigadeQueueScreen')
    } catch {
      Alert.alert(t('common.error_generic'))
    } finally {
      setJoining(false)
    }
  }, [preview, joinCode, navigation, setActiveBrigade, t])

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 32 }} />
      ) : (
        <FlatList
          data={brigades}
          keyExtractor={(b) => b.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>{t('brigade.my_brigades')}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.brigadeRow}>
              <View style={styles.brigadeInfo}>
                <Text style={styles.brigadeName}>{item.name}</Text>
                <Text style={styles.brigadeComm}>{item.community}</Text>
              </View>
              <TouchableOpacity
                style={styles.enterBtn}
                onPress={() => handleEnter(item.id)}
                testID={`enter-${item.id}`}
              >
                <Text style={styles.enterBtnText}>{t('brigade.enter')}</Text>
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.joinSection}>
              <Text style={styles.sectionLabel}>{t('brigade.join_section')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('brigade.join_code_placeholder')}
                value={joinCode}
                onChangeText={(v) => { setJoinCode(v.toUpperCase()); setPreview(null) }}
                maxLength={6}
                autoCapitalize="characters"
                testID="join-code-input"
              />
              <TouchableOpacity
                style={styles.searchBtn}
                onPress={handleSearch}
                disabled={searching || joinCode.length !== 6}
                testID="search-btn"
              >
                <Text style={styles.searchBtnText}>
                  {searching ? '...' : t('brigade.search')}
                </Text>
              </TouchableOpacity>
              {preview && (
                <View style={styles.preview}>
                  <Text style={styles.previewName}>{preview.name}</Text>
                  <Text style={styles.previewComm}>{preview.community}</Text>
                  <TouchableOpacity
                    style={[styles.searchBtn, { backgroundColor: '#10B981' }]}
                    onPress={handleJoin}
                    disabled={joining}
                    testID="confirm-join-btn"
                  >
                    <Text style={styles.searchBtnText}>
                      {joining ? '...' : t('brigade.confirm_join')}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  list: { padding: 16 },
  sectionLabel: { fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, marginTop: 8 },
  brigadeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  brigadeInfo: { flex: 1 },
  brigadeName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  brigadeComm: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  enterBtn: { backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  enterBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  joinSection: { marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12,
    fontSize: 16, marginBottom: 8, backgroundColor: '#fff', letterSpacing: 2,
  },
  searchBtn: {
    backgroundColor: '#3B82F6', borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 8,
  },
  searchBtnText: { color: '#fff', fontWeight: '700' },
  preview: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: '#A7F3D0', marginBottom: 8,
  },
  previewName: { fontSize: 15, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
  previewComm: { fontSize: 12, color: '#94A3B8', marginBottom: 10 },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- BrigadeHomeScreen
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/doctor/BrigadeHomeScreen.tsx apps/mobile/src/__tests__/BrigadeHomeScreen.test.tsx
git commit -m "feat(mobile): BrigadeHomeScreen — list brigades and join flow"
```

---

### Task 8: BrigadeQueueScreen + tests

**Files:**
- Modify: `apps/mobile/src/screens/doctor/BrigadeQueueScreen.tsx` (replace stub)
- Create: `apps/mobile/src/__tests__/BrigadeQueueScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/BrigadeQueueScreen.test.tsx`:

```typescript
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import BrigadeQueueScreen from '../screens/doctor/BrigadeQueueScreen'
import api from '../lib/api'
import { useBrigadeStore } from '../store/brigadeStore'
import NetInfo from '@react-native-community/netinfo'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}))
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, opts?: any) => opts ? `${k}:${JSON.stringify(opts)}` : k }) }))
jest.mock('../store/brigadeStore', () => {
  const actual = jest.requireActual('../store/brigadeStore')
  return actual
})

const mockPost = api.post as jest.Mock
const mockNetInfoAdd = NetInfo.addEventListener as jest.Mock

const navigation = { navigate: jest.fn(), goBack: jest.fn() }

const activeBrigade = { id: 'b1', name: 'Brigada Norte', community: 'X', status: 'active' as const }

const pendingItem = {
  local_id: 'loc-1',
  patient_phone: '+50499111111',
  patient_name: 'María',
  medications: [],
  created_at: new Date().toISOString(),
  synced: false,
}

const syncedItem = {
  ...pendingItem,
  local_id: 'loc-2',
  patient_name: 'Juan',
  synced: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  useBrigadeStore.setState({
    activeBrigade,
    brigades: [],
    patientCache: [],
    offlineQueue: [pendingItem, syncedItem],
    syncState: 'idle',
    lastSyncedAt: null,
  })
  mockNetInfoAdd.mockImplementation(() => jest.fn())
})

describe('BrigadeQueueScreen', () => {
  it('renders pending and synced counts', async () => {
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByTestId('pending-count')).toBeTruthy()
      expect(getByTestId('synced-count')).toBeTruthy()
    })
  })

  it('renders consultation items from offlineQueue', async () => {
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await waitFor(() => {
      expect(getByTestId('queue-item-loc-1')).toBeTruthy()
      expect(getByTestId('queue-item-loc-2')).toBeTruthy()
    })
  })

  it('sync button calls POST /api/sync/consultations with pending items', async () => {
    mockPost.mockResolvedValue({ data: { accepted: ['loc-1'], rejected: [] } })
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await act(async () => { fireEvent.press(getByTestId('sync-btn')) })
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/sync/consultations', expect.objectContaining({
        brigade_id: 'b1',
        consultations: expect.arrayContaining([
          expect.objectContaining({ local_id: 'loc-1' }),
        ]),
      }))
    })
  })

  it('marks items as synced after successful sync', async () => {
    mockPost.mockResolvedValue({ data: { accepted: ['loc-1'], rejected: [] } })
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await act(async () => { fireEvent.press(getByTestId('sync-btn')) })
    await waitFor(() => {
      const queue = useBrigadeStore.getState().offlineQueue
      expect(queue.find(c => c.local_id === 'loc-1')?.synced).toBe(true)
    })
  })

  it('NetInfo reconnect triggers auto-sync when pending items exist', async () => {
    let capturedListener: ((state: any) => void) | null = null
    mockNetInfoAdd.mockImplementation((cb: any) => {
      capturedListener = cb
      return jest.fn()
    })
    mockPost.mockResolvedValue({ data: { accepted: ['loc-1'], rejected: [] } })
    render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await act(async () => { capturedListener?.({ isConnected: true }) })
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/api/sync/consultations', expect.any(Object))
    })
  })

  it('leave brigade button clears activeBrigade and goes back', async () => {
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    await act(async () => { fireEvent.press(getByTestId('leave-btn')) })
    await waitFor(() => {
      expect(useBrigadeStore.getState().activeBrigade).toBeNull()
      expect(navigation.goBack).toHaveBeenCalled()
    })
  })

  it('new consultation button navigates to BrigadeConsultationScreen', async () => {
    const { getByTestId } = render(<BrigadeQueueScreen navigation={navigation} route={{} as any} />)
    fireEvent.press(getByTestId('new-consultation-btn'))
    expect(navigation.navigate).toHaveBeenCalledWith('BrigadeConsultationScreen', {})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- BrigadeQueueScreen
```

Expected: FAIL — stub renders nothing meaningful.

- [ ] **Step 3: Implement BrigadeQueueScreen**

Replace `apps/mobile/src/screens/doctor/BrigadeQueueScreen.tsx` with:

```typescript
import React, { useEffect, useMemo, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import NetInfo from '@react-native-community/netinfo'
import api from '../../lib/api'
import { useBrigadeStore } from '../../store/brigadeStore'

export default function BrigadeQueueScreen({ navigation }: any) {
  const { t } = useTranslation()
  const {
    activeBrigade, offlineQueue, syncState,
    markSynced, markRejected, setSyncState, setLastSyncedAt, clearActiveBrigade,
  } = useBrigadeStore()

  const pending = useMemo(() => offlineQueue.filter(c => !c.synced), [offlineQueue])
  const synced  = useMemo(() => offlineQueue.filter(c => c.synced),  [offlineQueue])

  const doSync = useCallback(async () => {
    if (syncState === 'syncing' || !activeBrigade || pending.length === 0) return
    setSyncState('syncing')
    try {
      const { data } = await api.post('/api/sync/consultations', {
        brigade_id:    activeBrigade.id,
        consultations: pending.map(c => ({
          local_id:      c.local_id,
          patient_phone: c.patient_phone,
          patient_name:  c.patient_name,
          symptoms_text: c.symptoms_text,
          diagnosis:     c.diagnosis,
          medications:   c.medications,
          created_at:    c.created_at,
        })),
      })
      await markSynced(data.accepted)
      await markRejected(data.rejected)
      setLastSyncedAt(new Date().toISOString())
      setSyncState('idle')
    } catch {
      setSyncState('error')
      Alert.alert(t('common.error_generic'))
    }
  }, [syncState, activeBrigade, pending, markSynced, markRejected, setSyncState, setLastSyncedAt, t])

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && syncState === 'idle' && pending.length > 0) {
        doSync()
      }
    })
    return () => unsubscribe()
  }, [syncState, pending, doSync])

  const handleLeave = useCallback(async () => {
    await clearActiveBrigade()
    navigation.goBack()
  }, [clearActiveBrigade, navigation])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brigadeName}>{activeBrigade?.name}</Text>
        <TouchableOpacity style={styles.syncBtn} onPress={doSync} testID="sync-btn">
          <Text style={styles.syncBtnText}>{t('brigade.sync')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBadge} testID="pending-count">
          <Text style={[styles.statText, { color: '#F59E0B' }]}>
            {t('brigade.pending_count', { count: pending.length })}
          </Text>
        </View>
        <View style={styles.statBadge} testID="synced-count">
          <Text style={[styles.statText, { color: '#10B981' }]}>
            {t('brigade.synced_count', { count: synced.length })}
          </Text>
        </View>
      </View>

      <FlatList
        data={offlineQueue}
        keyExtractor={(c) => c.local_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            testID={`queue-item-${item.local_id}`}
            onPress={() => navigation.navigate('BrigadeConsultationScreen', { local_id: item.local_id })}
          >
            <View style={styles.cardRow}>
              <Text style={styles.patientName}>{item.patient_name}</Text>
              <Text style={[styles.badge, item.synced ? styles.badgeSynced : styles.badgePending]}>
                {item.synced ? t('brigade.synced') : t('brigade.draft')}
              </Text>
            </View>
            <Text style={styles.phone}>{item.patient_phone}</Text>
            {item.sync_error && <Text style={styles.errorText}>{item.sync_error}</Text>}
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.newBtn}
          onPress={() => navigation.navigate('BrigadeConsultationScreen', {})}
          testID="new-consultation-btn"
        >
          <Text style={styles.newBtnText}>{t('brigade.new_consultation')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLeave} testID="leave-btn">
          <Text style={styles.leaveText}>{t('brigade.leave')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  brigadeName: { fontSize: 16, fontWeight: '700', color: '#1E293B', flex: 1 },
  syncBtn: { backgroundColor: '#3B82F6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  syncBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 8, padding: 12 },
  statBadge: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  statText: { fontSize: 12, fontWeight: '600' },
  list: { padding: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  patientName: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  badge: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgePending: { backgroundColor: '#FEF3C7', color: '#D97706' },
  badgeSynced:  { backgroundColor: '#D1FAE5', color: '#059669' },
  phone: { fontSize: 12, color: '#94A3B8' },
  errorText: { fontSize: 11, color: '#EF4444', marginTop: 4 },
  footer: { padding: 16, gap: 8 },
  newBtn: { backgroundColor: '#EF4444', borderRadius: 10, padding: 14, alignItems: 'center' },
  newBtnText: { color: '#fff', fontWeight: '700' },
  leaveText: { color: '#94A3B8', fontSize: 13, textAlign: 'center' },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- BrigadeQueueScreen
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/doctor/BrigadeQueueScreen.tsx apps/mobile/src/__tests__/BrigadeQueueScreen.test.tsx
git commit -m "feat(mobile): BrigadeQueueScreen — offline queue + sync"
```

---

### Task 9: BrigadeConsultationScreen + tests + full run

**Files:**
- Modify: `apps/mobile/src/screens/doctor/BrigadeConsultationScreen.tsx` (replace stub)
- Create: `apps/mobile/src/__tests__/BrigadeConsultationScreen.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/BrigadeConsultationScreen.test.tsx`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npm test -- BrigadeConsultationScreen
```

Expected: FAIL — stub doesn't have testIDs or behavior.

- [ ] **Step 3: Implement BrigadeConsultationScreen**

Replace `apps/mobile/src/screens/doctor/BrigadeConsultationScreen.tsx` with:

```typescript
import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useBrigadeStore } from '../../store/brigadeStore'

interface MedRow {
  name: string
  dose: string
  frequency: string
}

export default function BrigadeConsultationScreen({ navigation, route }: any) {
  const { t } = useTranslation()
  const { local_id } = (route.params ?? {}) as { local_id?: string }
  const { patientCache, offlineQueue, addConsultation } = useBrigadeStore()

  const [phone, setPhone]   = useState('')
  const [name, setName]     = useState('')
  const [symptoms, setSymptoms]   = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [meds, setMeds] = useState<MedRow[]>([])

  useEffect(() => {
    if (local_id) {
      const existing = offlineQueue.find(c => c.local_id === local_id)
      if (existing) {
        setPhone(existing.patient_phone)
        setName(existing.patient_name)
        setSymptoms(existing.symptoms_text ?? '')
        setDiagnosis(existing.diagnosis ?? '')
        setMeds(existing.medications)
      }
    }
  }, [local_id, offlineQueue])

  const handlePhoneBlur = useCallback(() => {
    if (name) return
    const cached = patientCache.find(p => p.phone === phone)
    if (cached) setName(cached.name)
  }, [phone, name, patientCache])

  const handleSave = useCallback(() => {
    if (!phone.trim() || !name.trim()) {
      Alert.alert(t('brigade.error_required'))
      return
    }
    addConsultation({
      patient_phone: phone.trim(),
      patient_name:  name.trim(),
      symptoms_text: symptoms.trim() || undefined,
      diagnosis:     diagnosis.trim() || undefined,
      medications:   meds.filter(m => m.name && m.dose && m.frequency),
      created_at:    new Date().toISOString(),
    })
    navigation.goBack()
  }, [phone, name, symptoms, diagnosis, meds, addConsultation, navigation, t])

  const addMed = useCallback(() => {
    setMeds(prev => [...prev, { name: '', dose: '', frequency: '' }])
  }, [])

  const removeMed = useCallback((idx: number) => {
    setMeds(prev => prev.filter((_, i) => i !== idx))
  }, [])

  const updateMed = useCallback((idx: number, field: keyof MedRow, value: string) => {
    setMeds(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m))
  }, [])

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.label}>{t('brigade.patient_phone')}</Text>
      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        onBlur={handlePhoneBlur}
        keyboardType="phone-pad"
        testID="phone-input"
      />

      <Text style={styles.label}>{t('brigade.patient_name')}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        testID="name-input"
      />

      <Text style={styles.label}>{t('brigade.symptoms')}</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={symptoms}
        onChangeText={setSymptoms}
        multiline
        numberOfLines={3}
        testID="symptoms-input"
      />

      <Text style={styles.label}>{t('brigade.diagnosis')}</Text>
      <TextInput
        style={styles.input}
        value={diagnosis}
        onChangeText={setDiagnosis}
        testID="diagnosis-input"
      />

      <Text style={styles.label}>{t('brigade.medications')}</Text>
      {meds.map((m, i) => (
        <View key={i} style={styles.medRow}>
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('brigade.med_name')}
            value={m.name}
            onChangeText={v => updateMed(i, 'name', v)}
          />
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('brigade.med_dose')}
            value={m.dose}
            onChangeText={v => updateMed(i, 'dose', v)}
          />
          <TextInput
            style={[styles.input, styles.medInput]}
            placeholder={t('brigade.med_frequency')}
            value={m.frequency}
            onChangeText={v => updateMed(i, 'frequency', v)}
          />
          <TouchableOpacity onPress={() => removeMed(i)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>{t('brigade.remove_medication')}</Text>
          </TouchableOpacity>
        </View>
      ))}
      <TouchableOpacity onPress={addMed} style={styles.addMedBtn}>
        <Text style={styles.addMedText}>{t('brigade.add_medication')}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} testID="save-btn">
        <Text style={styles.saveBtnText}>{t('brigade.save_offline')}</Text>
      </TouchableOpacity>
      <Text style={styles.willSync}>{t('brigade.will_sync')}</Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16 },
  label: { fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12,
    fontSize: 15, backgroundColor: '#fff', marginBottom: 4,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  medRow: { marginBottom: 8 },
  medInput: { marginBottom: 4 },
  removeBtn: { alignSelf: 'flex-start', marginBottom: 4 },
  removeBtnText: { color: '#EF4444', fontSize: 12 },
  addMedBtn: { marginTop: 4, marginBottom: 16 },
  addMedText: { color: '#3B82F6', fontWeight: '600' },
  saveBtn: { backgroundColor: '#EF4444', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  willSync: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 8 },
})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd apps/mobile && npm test -- BrigadeConsultationScreen
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full mobile test suite**

```bash
cd apps/mobile && npm test -- --passWithNoTests
```

Expected: all tests PASS. Count includes existing suite + new brigade tests.

- [ ] **Step 6: Run full API test suite**

```bash
cd packages/api && npx vitest run
```

Expected: all 23 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/doctor/BrigadeConsultationScreen.tsx apps/mobile/src/__tests__/BrigadeConsultationScreen.test.tsx
git commit -m "feat(mobile): BrigadeConsultationScreen — offline consultation form"
```
