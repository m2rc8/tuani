# Doctor Flow — Mobile Design Spec

**Date:** 2026-05-05
**Project:** MédicoYa
**Scope:** Doctor-facing screens for Phase 1 MVP — consultation queue, real-time chat, prescription writing, history.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Navigation structure | Separate `DoctorStack` above `DoctorTabs`, mirrors existing `PatientStack` pattern |
| Queue discovery | REST load on mount + socket push (`new_consultation` event) for real-time arrivals |
| Reject button | Yes — doctors can reject from queue, patient sees `rejected` status |
| Prescription writing | Separate `WriteRxScreen` (navigated to from DoctorConsultationScreen header button) |
| DoctorHistoryScreen | Reuses existing `GET /consultations/my` (role=doctor filters by doctor_id), taps to `PrescriptionScreen` |
| State management | Reuse existing `consultationStore` (messages + status); no new Zustand store |

---

## 2. Navigation Structure

```
RootNavigator (Stack)
├── PatientStack  (role === 'patient')   ← unchanged
│   ├── PatientTabs
│   ├── WaitingScreen
│   ├── ConsultationScreen
│   └── PrescriptionScreen
└── DoctorStack   (role === 'doctor')   ← new
    ├── DoctorTabs
    │   ├── Queue tab    → QueueScreen
    │   ├── History tab  → DoctorHistoryScreen
    │   └── Profile tab  → ProfileScreen (reused, no changes)
    ├── DoctorConsultationScreen
    └── WriteRxScreen
```

```ts
export type DoctorStackParamList = {
  DoctorTabs: undefined
  DoctorConsultationScreen: { consultationId: string }
  WriteRxScreen: { consultationId: string }
}
```

---

## 3. Screens

### 3.1 QueueScreen (modified from stub)

**Purpose:** Shows all pending consultations. Doctor accepts or rejects each.

**Behavior:**
- On mount: `GET /consultations/queue` → render list of pending consultations sorted by `created_at` ascending (oldest first).
- Socket: connect. Doctors are auto-joined to `doctors` room server-side on connect (no client emit needed). Listen `new_consultation` → prepend card to list. Listen `consultation_updated` → remove card from list if `status !== 'pending'` (accepted or rejected by another doctor).
- Card content: masked patient phone (last 4 digits shown: `•••• 1234`), `symptoms_text` truncated to ~120 chars, time waiting (e.g. "hace 2 min").
- **Accept button:** `PUT /api/consultations/:id/accept` → on success: optimistically remove from list, navigate to `DoctorConsultationScreen`.
- **Reject button:** `PUT /api/consultations/:id/reject` → on success: remove from list.
- Empty state: `t('queue.empty')`.
- Loading state: `ActivityIndicator` on first fetch.

**API:** `GET /consultations/queue` (new), `PUT /consultations/:id/accept`, `PUT /consultations/:id/reject`
**Socket:** listen `new_consultation`, listen `consultation_updated`

---

### 3.2 DoctorConsultationScreen (new stack screen)

**Purpose:** Real-time chat with patient from doctor's perspective.

**Behavior:**
- On mount: `GET /consultations/:id` to load message history. Render existing messages in `FlatList`.
- Socket: `join_consultation` with `consultation_id`. Listen `receive_message` → append to list, scroll to bottom.
- Chat input + send button → `send_message` socket event.
- Header right button: **"Completar"** → navigate to `WriteRxScreen` with `{ consultationId }`.
- "Completar" button disabled if `status === 'completed'`.
- `consultation_updated(completed)` event: set status to `completed`, input becomes read-only, header button disappears.
- Back navigation: returns to `DoctorTabs` (queue/history). Socket listeners cleaned up on unmount.

**API:** `GET /consultations/:id`
**Socket:** `join_consultation`, `send_message`, `receive_message`, `consultation_updated`

---

### 3.3 WriteRxScreen (new stack screen)

**Purpose:** Doctor fills diagnosis + medications to complete the consultation.

**Form fields:**
- `diagnosis` — required TextInput (multiline)
- `diagnosis_code` — optional TextInput (ICD-10 code, single line)
- `medications` — dynamic list; each row has: `name`, `dose`, `frequency` (all TextInputs). "Agregar medicamento" button adds a row; trash icon removes a row. Minimum 1 medication required.
- `instructions` — optional TextInput (multiline, additional instructions)
- `price_lps` — optional numeric TextInput (consultation fee in lempiras)

**Behavior:**
- Submit button disabled until `diagnosis` is non-empty and at least 1 medication has `name` filled.
- On submit: `PUT /consultations/:id/complete` with `{ diagnosis, diagnosis_code, medications, instructions, price_lps }`.
- On success: `navigation.goBack()` → returns to `DoctorConsultationScreen`, which shows completed state (prescription card visible for patient, chat read-only).
- On error: `Alert` with generic error message.

**API:** `PUT /consultations/:id/complete`

---

### 3.4 DoctorHistoryScreen (modified from stub)

**Purpose:** List of doctor's past consultations.

**Behavior:**
- `GET /consultations/my` on mount (role=doctor returns consultations where `doctor_id = userId`).
- Same card pattern as patient `HistoryScreen`: date, status badge, diagnosis (if completed).
- Tap completed → navigate to `PrescriptionScreen` (existing screen, reused as-is with `{ consultationId }`).
- Tap active/pending → navigate to `DoctorConsultationScreen`.
- Empty state: `t('history.empty')` (reuses existing key).

**API:** `GET /consultations/my`

---

## 4. Backend Changes

### 4.1 New REST endpoint: `GET /consultations/queue`

**File:** `packages/api/src/routes/consultations.ts`

- Route: `GET /queue` (before `GET /:id` to avoid param conflict)
- Middleware: `requireAuth`, `requireRole(Role.doctor)`
- Handler: direct Prisma query — no new service method needed:

```ts
const consultations = await prisma.consultation.findMany({
  where: { status: 'pending' },
  include: { patient: { select: { phone: true } } },
  orderBy: { created_at: 'asc' },
})
```

Response shape per item:
```ts
{
  id: string
  status: 'pending'
  symptoms_text: string | null
  created_at: string
  patient: { phone: string }
}
```

### 4.2 Socket: `doctors` room + `new_consultation` event

**File:** `packages/api/src/sockets/consultation.ts`

**On doctor connect:** In the socket auth handler, after verifying JWT, if `role === 'doctor'`, call `socket.join('doctors')`.

**On consultation created:** `ConsultationService` already receives `io` via constructor injection (`new ConsultationService(db, io)` in `createApp`). In `createConsultation()`, after the DB insert, emit:

```ts
this.io?.to('doctors').emit('new_consultation', {
  id: consultation.id,
  symptoms_text: consultation.symptoms_text,
  created_at: consultation.created_at,
  patient: { phone: consultation.patient.phone },
})
```

No route handler change needed — all socket logic stays in the service layer.

---

## 5. i18n Keys Required

New keys in `es.json` and `en.json`:

```
queue.title
queue.empty
queue.accept
queue.reject
queue.waiting_since

doctor.complete_cta
doctor.rx_title
doctor.diagnosis_label
doctor.diagnosis_code_label
doctor.add_medication
doctor.remove_medication
doctor.medication_name
doctor.medication_dose
doctor.medication_frequency
doctor.instructions_label
doctor.price_label
doctor.submit_rx
```

---

## 6. Files Changed

| Action | File |
|--------|------|
| MOD | `apps/mobile/src/navigation/RootNavigator.tsx` |
| NEW | `apps/mobile/src/navigation/DoctorStack.tsx` |
| MOD | `apps/mobile/src/screens/doctor/QueueScreen.tsx` |
| NEW | `apps/mobile/src/screens/doctor/DoctorConsultationScreen.tsx` |
| NEW | `apps/mobile/src/screens/doctor/WriteRxScreen.tsx` |
| MOD | `apps/mobile/src/screens/doctor/HistoryScreen.tsx` |
| MOD | `apps/mobile/src/i18n/es.json` |
| MOD | `apps/mobile/src/i18n/en.json` |
| MOD | `packages/api/src/routes/consultations.ts` |
| MOD | `packages/api/src/sockets/consultation.ts` |

---

## 7. Out of Scope (Phase 1)

- Payment confirmation flow (`PUT /consultations/:id/payment`)
- Doctor availability toggle (separate settings screen)
- Push notifications for new consultations
- Video/audio call
- Doctor rating by patient
- Photo attachments in chat
