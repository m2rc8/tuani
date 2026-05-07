# Brigade Mobile Mode — Design Spec

**Date:** 2026-05-06
**Project:** MédicoYa
**Scope:** Sub-project 2 of 3 — Mobile offline UI for brigade doctors. API Brigade endpoints (Sub-project 1) are already implemented.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Nav entry point | Banner/button at top of QueueScreen |
| Navigation structure | Dedicated BrigadeStack (3 screens) inside DoctorStack |
| Offline seed data | Brigade info + doctor list + patient phone cache |
| Sync trigger | Auto on NetInfo reconnect + manual "Sync" button |
| Multiple brigades | Pick one at a time; BrigadeHomeScreen lists all joined brigades |
| State persistence | Zustand store persisted via AsyncStorage |
| Join flow | GET /api/brigades/by-code/:code (preview) → POST /api/brigades/:id/join (confirm) |

---

## 2. Navigation Architecture

BrigadeStack is added to DoctorStack (native-stack). Existing tabs (Queue, History, Profile) and DoctorStack screens are unchanged.

```
DoctorStack (native-stack)
├── DoctorTabs (bottom-tabs)
│   ├── QueueScreen           ← brigade banner added here
│   ├── DoctorHistoryScreen
│   └── DoctorProfileScreen
├── DoctorConsultationScreen
├── WriteRxScreen
├── PrescriptionScreen
├── BrigadeHomeScreen         ← new
├── BrigadeQueueScreen        ← new
└── BrigadeConsultationScreen ← new
```

**QueueScreen change:** A banner at the top reads "Unirse a una brigada →". Tapping navigates to `BrigadeHomeScreen`. Banner is always visible (not only when in brigade mode).

**BrigadeHomeScreen:** Lists brigades the doctor belongs to (from API). Each row has an "Entrar" button that seeds the brigade (downloads patient cache) and navigates to `BrigadeQueueScreen`. Also has a join-new-brigade form (6-char code input).

**BrigadeQueueScreen:** Shows offline consultation list for the active brigade. Header displays brigade name + sync button. "← Salir de brigada" text link clears `activeBrigade` and pops to DoctorStack.

**BrigadeConsultationScreen:** Offline consultation form. Accessed via "+ Nueva consulta" button in BrigadeQueueScreen.

---

## 3. State — `brigadeStore`

File: `apps/mobile/src/stores/brigadeStore.ts`

```typescript
interface BrigadeInfo {
  id: string
  name: string
  community: string
  status: 'active' | 'closed'
}

interface OfflineConsultation {
  local_id: string        // crypto.randomUUID() on device
  patient_phone: string
  patient_name: string
  symptoms_text?: string
  diagnosis?: string
  medications: { name: string; dose: string; frequency: string }[]
  created_at: string      // ISO datetime, set at creation time
  synced: boolean
  sync_error?: string
}

interface BrigadeStore {
  activeBrigade: BrigadeInfo | null
  brigades: BrigadeInfo[]
  patientCache: { phone: string; name: string }[]
  offlineQueue: OfflineConsultation[]
  syncState: 'idle' | 'syncing' | 'error'
  lastSyncedAt: string | null

  // actions
  setActiveBrigade: (brigade: BrigadeInfo, patients: { phone: string; name: string }[]) => void
  clearActiveBrigade: () => void
  addConsultation: (c: Omit<OfflineConsultation, 'local_id' | 'synced'>) => string
  markSynced: (local_ids: string[]) => void
  markRejected: (items: { local_id: string; reason: string }[]) => void
  setBrigades: (brigades: BrigadeInfo[]) => void
}
```

Persisted via `zustand/middleware` `persist` with `AsyncStorage` as storage. Keys persisted: `activeBrigade`, `brigades`, `patientCache`, `offlineQueue`, `lastSyncedAt`. `syncState` is not persisted (reset to `'idle'` on hydrate).

---

## 4. API Additions

Three new endpoints + one seed response extension. All changes in `packages/api`.

### `GET /api/brigades` (list mine)

- Auth: `requireAuth` + `requireRole(Role.doctor)`
- Returns brigades where caller has a `BrigadeDoctor` row
- Returns 200 + `[{ id, name, community, status, joined_at }]`
- Used by BrigadeHomeScreen on mount to populate brigade list

### `GET /api/brigades/by-code/:code`

- Auth: `requireAuth` + `requireRole(Role.doctor)`
- Looks up brigade by `join_code` (case-insensitive)
- Returns 200 + `{ id, name, community, municipality, department, start_date, end_date, status }`
- Returns 404 if not found
- No side effects (preview only)

### `GET /api/sync/brigade/:id` (extend existing)

Current response: `{ brigade: {...}, doctors: [{ id, name }] }`
New response adds: `patients: [{ phone: string; name: string }]`

`patients` = distinct `{ patient_phone, patient_name }` from all consultations in this brigade, ordered by most recently synced. Capped at 500 rows.

### `BrigadeService.getBrigadeSeed` (extend)

Add patient query:

```typescript
const patients = await this.db.consultation.findMany({
  where: { brigade_id: brigadeId },
  select: { patient: { select: { phone: true, user: { select: { name: true } } } } },
  orderBy: { synced_at: 'desc' },
  take: 500,
})
// deduplicate by phone before returning
```

---

## 5. Screens

### `BrigadeHomeScreen`

1. On mount: fetch `GET /api/brigades` (new list endpoint — returns brigades where caller is a member) — store in `brigadeStore.brigades`
2. Render FlatList of brigades with "Entrar" button per row
3. "Entrar" → `GET /api/sync/brigade/:id` → `setActiveBrigade(brigade, patients)` → navigate to `BrigadeQueueScreen`
4. Join form: text input (uppercase, maxLength=6) + "Buscar brigada" button
5. "Buscar brigada" → `GET /api/brigades/by-code/:code` → show brigade preview modal → confirm → `POST /api/brigades/:id/join` → refresh brigade list

### `BrigadeQueueScreen`

1. On mount: if no `activeBrigade`, navigate back
2. Header: brigade name + `↑ Sync` button
3. Stats row: "⏳ N sin sync" + "✓ N synced" counts derived from `offlineQueue`
4. FlatList of `offlineQueue` items, sorted by `created_at` desc. Tap item → navigate to `BrigadeConsultationScreen` with `local_id` param (edit mode)
5. Sync button + auto-sync on NetInfo `'connected'` event:
   - Set `syncState = 'syncing'`
   - Filter `offlineQueue` where `!synced`
   - POST `/api/sync/consultations` with `{ brigade_id, consultations: [...] }`
   - Call `markSynced(accepted)` + `markRejected(rejected)`
   - Set `lastSyncedAt`, `syncState = 'idle'`
6. "+ Nueva consulta" → navigate to `BrigadeConsultationScreen` (create mode)
7. "← Salir de brigada" → `clearActiveBrigade()` → `navigation.goBack()`

**NetInfo integration:** `useEffect` subscribes to `NetInfo.addEventListener`. On `isConnected === true` and `syncState === 'idle'` and pending items exist → trigger sync.

### `BrigadeConsultationScreen`

Params: `{ local_id?: string }` (undefined = create, set = edit)

1. On mount: if `local_id` provided, load existing consultation from `offlineQueue` into form state
2. Fields: phone (required), name (required, autofill), symptoms_text, diagnosis, medications list
3. **Autofill:** on phone field `onBlur` → search `patientCache` by phone → if found, set name field (user can override)
4. Medications: sub-list with add/remove. Each: name, dose, frequency (all required if row exists)
5. Save: call `addConsultation(formData)` → navigate back to `BrigadeQueueScreen`

---

## 6. i18n Keys

Add to `apps/mobile/src/i18n/es.json` under `"brigade"` namespace:

```json
"brigade": {
  "title": "Brigadas",
  "join": "Unirse a una brigada",
  "join_code_placeholder": "Código (ej. ABC123)",
  "search": "Buscar brigada",
  "enter": "Entrar",
  "leave": "← Salir de brigada",
  "new_consultation": "+ Nueva consulta",
  "sync": "↑ Sync",
  "pending": "sin sync",
  "synced": "synced",
  "draft": "borrador",
  "save_offline": "Guardar (offline)",
  "will_sync": "Se sincronizará automáticamente con conexión",
  "patient_phone": "Teléfono",
  "patient_name": "Nombre",
  "symptoms": "Síntomas",
  "diagnosis": "Diagnóstico",
  "medications": "Medicamentos",
  "add_medication": "+ Agregar medicamento",
  "preview_title": "Unirse a brigada",
  "preview_confirm": "Confirmar",
  "preview_cancel": "Cancelar"
}
```

---

## 7. Types

Add to `apps/mobile/src/lib/types.ts`:

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

---

## 8. Tests

### API

| File | Test |
|------|------|
| `brigades.test.ts` | `GET /` doctor gets own brigade list → 200 + array |
| `brigades.test.ts` | `GET /by-code/ABC123` found → 200 + brigade info |
| `brigades.test.ts` | `GET /by-code/XXXXXX` not found → 404 |
| `brigades.test.ts` | `GET /by-code/ABC123` no auth → 401 |
| `sync.test.ts` | `GET /brigade/:id` response includes `patients` array |

### Mobile

| File | Tests |
|------|-------|
| `brigadeStore.test.ts` | addConsultation generates local_id; markSynced flips flag; clearActiveBrigade nulls activeBrigade + clears patientCache |
| `BrigadeHomeScreen.test.tsx` | renders brigade list from API; join code form fetches preview; confirm join navigates |
| `BrigadeQueueScreen.test.tsx` | pending/synced counts; sync button calls API + updates store; NetInfo reconnect triggers sync |
| `BrigadeConsultationScreen.test.tsx` | phone autofill from cache; save adds to store queue; required field validation blocks save |

---

## 9. File Map

| Action | File |
|--------|------|
| MOD | `packages/api/src/routes/brigades.ts` — add `GET /` (list mine) + `GET /by-code/:code` |
| MOD | `packages/api/src/services/BrigadeService.ts` — extend `getBrigadeSeed` + add `getBrigadeByCode` + add `getMyBrigades` |
| MOD | `packages/api/src/routes/brigades.test.ts` — 4 new tests (list mine + by-code found/not-found/no-auth) |
| MOD | `packages/api/src/routes/sync.test.ts` — update seed test to assert `patients` |
| NEW | `apps/mobile/src/stores/brigadeStore.ts` |
| NEW | `apps/mobile/src/stores/brigadeStore.test.ts` |
| MOD | `apps/mobile/src/lib/types.ts` — add BrigadeInfo, OfflineConsultation |
| MOD | `apps/mobile/src/i18n/es.json` — add brigade namespace |
| MOD | `apps/mobile/src/navigation/DoctorStack.tsx` — add 3 BrigadeStack screens |
| MOD | `apps/mobile/src/screens/doctor/QueueScreen.tsx` — add brigade banner |
| NEW | `apps/mobile/src/screens/doctor/BrigadeHomeScreen.tsx` |
| NEW | `apps/mobile/src/screens/doctor/BrigadeHomeScreen.test.tsx` |
| NEW | `apps/mobile/src/screens/doctor/BrigadeQueueScreen.tsx` |
| NEW | `apps/mobile/src/screens/doctor/BrigadeQueueScreen.test.tsx` |
| NEW | `apps/mobile/src/screens/doctor/BrigadeConsultationScreen.tsx` |
| NEW | `apps/mobile/src/screens/doctor/BrigadeConsultationScreen.test.tsx` |

---

## 10. Out of Scope

- Coordinator dashboard web UI (Sub-project 3)
- Editing a consultation after it has been synced
- Deleting consultations from the offline queue
- Brigade status transitions (active → closed) triggered from mobile
- PDF report generation
- En/EN locale keys (Spanish only for now)
