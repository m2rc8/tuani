# Doctor Availability Toggle — Design Spec

**Date:** 2026-05-06
**Project:** MédicoYa
**Scope:** Phase 1 — doctor availability toggle in mobile app.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Where | New `DoctorProfileScreen` (separate from shared `ProfileScreen`) |
| UI control | React Native `Switch` component |
| Current state source | `GET /api/doctors/me` fetched on mount |
| Update | `PUT /api/doctors/availability { available: boolean }` |
| Error handling | Optimistic update; revert + Alert on failure |
| Tests | jest-expo + @testing-library/react-native, 4 cases |

---

## 2. Architecture

### Files changed

| Action | File |
|--------|------|
| MOD | `packages/api/src/routes/doctors.ts` |
| NEW | `apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx` |
| MOD | `apps/mobile/src/navigation/DoctorTabs.tsx` |
| MOD | `apps/mobile/src/i18n/es.json` |
| MOD | `apps/mobile/src/i18n/en.json` |
| NEW | `apps/mobile/src/__tests__/DoctorProfileScreen.test.tsx` |

---

## 3. API — `GET /api/doctors/me`

Add to `packages/api/src/routes/doctors.ts` before the existing routes:

```typescript
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
```

Response shape: `{ id, available, cedula, approved_at, user: { name, phone } }` (full Doctor model + user).

Existing `PUT /doctors/availability` is unchanged.

---

## 4. Screen — `DoctorProfileScreen`

```
apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx
```

**On mount:** `GET /api/doctors/me` → set `available` state. Show `ActivityIndicator` while loading.

**Toggle:** React Native `Switch`. Label: `t('doctor.availability_label')`.

**On toggle:**
1. Optimistically flip local state.
2. Call `PUT /api/doctors/availability { available: newValue }`.
3. On error: revert state, show `Alert.alert(t('common.error_generic'))`.

**Below toggle:** Language selector (ES/EN buttons — same as shared `ProfileScreen`).

**Bottom:** "Cerrar sesión" button → `logout()` from `useAuthStore`.

---

## 5. Navigation

`apps/mobile/src/navigation/DoctorTabs.tsx` — replace:

```typescript
import ProfileScreen from '../screens/shared/ProfileScreen'
// ...
<Tab.Screen name="Profile" component={ProfileScreen} ... />
```

with:

```typescript
import DoctorProfileScreen from '../screens/doctor/DoctorProfileScreen'
// ...
<Tab.Screen name="Profile" component={DoctorProfileScreen} ... />
```

No changes to `DoctorStackParamList` — the Profile tab is not navigated to programmatically.

---

## 6. i18n

Add one key to each locale:

**`es.json`** — inside `"doctor"` block:
```json
"availability_label": "Disponible para consultas"
```

**`en.json`** — inside `"doctor"` block:
```json
"availability_label": "Available for consultations"
```

---

## 7. Tests

File: `apps/mobile/src/__tests__/DoctorProfileScreen.test.tsx`

Mock: `api.get` (for `GET /api/doctors/me`), `api.put` (for `PUT /api/doctors/availability`), `react-i18next`, `expo-secure-store`, `@react-native-async-storage/async-storage`.

| # | Test | Setup | Assert |
|---|------|-------|--------|
| 1 | Renders toggle off when available=false | `api.get` resolves `{ available: false }` | Switch testID `availability-switch` has `value={false}` |
| 2 | Renders toggle on when available=true | `api.get` resolves `{ available: true }` | Switch testID `availability-switch` has `value={true}` |
| 3 | Toggling calls PUT with flipped value | `api.get` → `false`; `api.put` resolves | `fireEvent(switch, 'valueChange', true)` → `api.put` called with `{ available: true }` |
| 4 | PUT failure reverts switch | `api.get` → `true`; `api.put` rejects | After `valueChange(false)` + reject: switch back to `true` |

testIDs: `availability-switch`, `lang-es`, `lang-en`, `logout-btn`.

---

## 8. Out of Scope

- Doctor name/bio editing
- Profile photo
- Real-time availability sync across devices (toggle is fire-and-forget)
