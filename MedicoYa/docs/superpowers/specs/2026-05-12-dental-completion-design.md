# Dental Feature Completion — Design Spec

**Date:** 2026-05-12
**Scope:** Three missing pieces in the dental expediente feature

---

## 1. Hygiene Notes + CPOD Index in DentalRecordScreen

### What
Add `hygiene_notes` (textarea) and `cpod_index` (numeric 0–32) fields to the doctor visit screen. Both fields exist in the DB schema, API, and types but have no UI.

### Placement
Between the odontogram save button and the treatment plan section — all written-notes fields grouped together:

```
Odontogram → [Save odontogram] → [Higiene oral + CPOD] → Plan de tratamiento → Referencia → Tratamientos
```

### Behavior
- Pre-populated from `visit.hygiene_notes` and `visit.cpod_index` on load (already fetched)
- CPOD input: `keyboardType="numeric"`, validated client-side (integer, 0–32) before save
- Single "Guardar" button covers both fields in one PATCH call
- PATCH body: `{ hygiene_notes, cpod_index }` → `PATCH /api/dental/visits/:visitId`
- API already handles this via `updateVisitSchema` — no API changes needed

---

## 2. Patient Dental View

### New API endpoint

```
GET /api/dental/files/mine
requireAuth (patient)
```

- Resolves `req.user.sub` → look up `user` with `patient` relation → use `patient.id`
- Returns same response shape as `GET /api/dental/files/:fileId`
- Returns 404 if patient has no dental file yet

### New Mobile Screens (src/screens/patient/)

#### PatientDentalExpedienteScreen
- Params: none (fetches own file)
- On focus: `GET /api/dental/files/mine`
- 404 → empty state: "Aún no tienes un expediente dental"
- Success → shows:
  - Read-only `<Odontogram>` (`selectedFdi={null}`, `onSelectTooth={() => {}}`)
  - Scrollable visit list: date, dentist name, treatment count
  - Tap visit → navigate to `PatientDentalVisitScreen { visitId, fileId }`

#### PatientDentalVisitScreen
- Params: `{ visitId: string, fileId: string }`
- Fetches `GET /api/dental/visits/:visitId` + `GET /api/dental/files/:fileId`
- Read-only layout (no inputs, no save buttons):
  - Read-only `<Odontogram>`
  - Hygiene notes display (text, hidden if null)
  - CPOD index display (text, hidden if null)
  - Treatment plan display (text, hidden if null)
  - Referral display (text, hidden if null)
  - Treatments list (same card format as doctor view, no add-form)

### Patient HistoryScreen changes
- Add Medical / Dental tab switcher (same pattern as doctor HistoryScreen)
- Dental tab: fetches `GET /api/dental/files/mine`
  - 404 → empty state "Aún no tienes visitas dentales"
  - Success → renders visit list from `file.visits` (date, dentist name, treatment count)
  - Tap → `PatientDentalVisitScreen`
- Existing Medical tab: no changes

### Navigation
- Register `PatientDentalExpedienteScreen` and `PatientDentalVisitScreen` in the patient stack
- No new bottom tab entries — entry point is the dental tab inside existing HistoryScreen

---

## 3. Brigade ID Linkage on Visit Creation

### What
When a dentist creates a new dental visit while an active dental brigade is in session, tag the visit with `brigade_id`. Currently `DentalExpedienteScreen` always sends an empty body `{}`.

### Change (DentalExpedienteScreen only)
```ts
const activeBrigade = useBrigadeStore(s => s.activeBrigade)

// in handleNewVisit:
const body = activeBrigade?.brigade_type === 'dental'
  ? { brigade_id: activeBrigade.id }
  : {}
await api.post(`/api/dental/files/${fileId}/visits`, body)
```

- Only passes `brigade_id` when `brigade_type === 'dental'` — prevents medical brigade IDs from leaking into dental visits
- No API changes (route already accepts optional `brigade_id`)
- No UI changes

---

## Files Affected

| File | Change |
|------|--------|
| `apps/mobile/src/screens/doctor/DentalRecordScreen.tsx` | Add hygiene_notes + cpod_index section |
| `apps/mobile/src/screens/doctor/DentalExpedienteScreen.tsx` | Pass brigade_id from store on visit create |
| `apps/mobile/src/screens/patient/HistoryScreen.tsx` | Add dental tab |
| `apps/mobile/src/screens/patient/PatientDentalExpedienteScreen.tsx` | New screen |
| `apps/mobile/src/screens/patient/PatientDentalVisitScreen.tsx` | New screen |
| `packages/api/src/routes/dental.ts` | Add GET /files/mine endpoint |
| `apps/mobile/src/navigation/RootNavigator.tsx` | Register new screens in PatientStack |

---

## Out of Scope
- Pediatric odontogram (minor patients)
- Treatment cost (`cost_lps`) UI
- Treatment status/priority UI
- Delete/edit treatment
- Brigade dental report screen
