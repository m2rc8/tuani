# Patient Flow — Mobile Design Spec

**Date:** 2026-05-05
**Project:** MédicoYa
**Scope:** Patient-facing screens for Phase 1 MVP — consultation creation, waiting, chat, prescription, history.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Doctor selection | Pool-based — no `doctor_id`. Any available doctor accepts from queue. |
| HomeScreen content | Symptom form IS the home screen. Doctor count badge shows service status. |
| Post-submit state | Dedicated WaitingScreen with spinner, symptoms preview, cancel button. |
| Prescription reveal | Prescription card appears as last message in chat. Tap → PrescriptionScreen. |
| Navigation pattern | Root stack above PatientTabs. ConsultationScreen/PrescriptionScreen/WaitingScreen are stack screens above the tabs. |

---

## 2. Navigation Structure

```
RootNavigator (Stack)
├── PatientTabs (BottomTabs)  ← existing
│   ├── Home tab → HomeScreen (symptom form)
│   ├── History tab → HistoryScreen (past consultations)
│   └── Profile tab → ProfileScreen (done — language + logout)
├── WaitingScreen             ← new stack screen
├── ConsultationScreen        ← new stack screen
└── PrescriptionScreen        ← new stack screen
```

PatientTabs param list adds no new params. Root stack param list:

```ts
type RootStackParamList = {
  PatientTabs: undefined
  DoctorTabs: undefined
  WaitingScreen: { consultationId: string }
  ConsultationScreen: { consultationId: string }
  PrescriptionScreen: { consultationId: string }
}
```

---

## 3. Screens

### 3.1 HomeScreen (modified)

**Purpose:** Entry point for starting a consultation.

**Behavior:**
- On mount: call `GET /doctors/available`. Show count in badge (e.g. "2 médicos disponibles").
- Poll every 30s to keep count fresh.
- If `consultationStore.activeConsultationId` exists on mount, redirect immediately to WaitingScreen or ConsultationScreen depending on stored status. This prevents the form appearing while a consultation is live.
- Symptom text input (max 500 chars, character counter shown).
- Optional photo picker (`expo-image-picker`). Shown as thumbnail when selected.
- Submit button disabled when text is empty or when 0 doctors available.
- On submit: `POST /consultations` (multipart if photo attached). On success: set `activeConsultationId` in store, navigate to WaitingScreen.

**API:** `GET /doctors/available`, `POST /consultations`

---

### 3.2 WaitingScreen (new)

**Purpose:** Shows patient is in queue, waiting for a doctor to accept.

**Behavior:**
- Displays spinner, "Buscando médico disponible", estimated wait ("2–5 min").
- Shows symptoms text preview (read-only).
- Cancel button: calls `PUT /consultations/:id/cancel`, clears store, navigates back to Home.
- Connects socket, calls `join_consultation` with `consultationId`.
- Listens for `status_changed` socket event (emitted by server when doctor accepts). On `status === 'in_progress'`, use `navigation.replace('ConsultationScreen', { consultationId })` — replaces WaitingScreen so back button returns to tabs, not back to waiting.
- If app is backgrounded and user returns: re-check consultation status via `GET /consultations/:id`. If already `in_progress`, navigate directly to ConsultationScreen.

**API:** `GET /consultations/:id`, `PUT /consultations/:id/cancel`
**Socket:** `join_consultation`, listen `status_changed`

---

### 3.3 ConsultationScreen (new)

**Purpose:** Real-time chat between patient and doctor.

**Behavior:**
- Header: doctor name + "En consulta" badge.
- On mount: `GET /consultations/:id` to load message history. Render existing messages.
- Socket: `join_consultation` (re-join if socket reconnected), listen `receive_message`, append to message list.
- Chat input: text + send button. `send_message` socket event. Optimistic append with pending state.
- When `status_changed` event arrives with `status === 'completed'`, re-fetch `GET /consultations/:id` to get prescription data, then append prescription card as last message:
  - Prescription card shows: diagnosis, medication count, "Ver receta completa →" button.
  - Input is disabled. Chat becomes read-only.
  - Tap "Ver receta completa" → navigate to PrescriptionScreen.
- Back navigation: allowed (returns to tabs). Socket stays connected via consultationStore.

**API:** `GET /consultations/:id`
**Socket:** `join_consultation`, `send_message`, `receive_message`, `status_changed`

---

### 3.4 PrescriptionScreen (new)

**Purpose:** Full prescription view with QR code.

**Content:**
- Doctor name + date.
- Diagnosis (text).
- Medication list: name, dose, frequency, duration.
- QR code rendered via `react-qr-code` (value = prescription ID or verification URL).
- "Guardar / Compartir" button: `expo-sharing` or screenshot.
- Footer: "Válido por 30 días".

**Data source:** Navigation params (`consultationId`). Fetch `GET /consultations/:id` on mount to get prescription data (prescription is embedded in consultation response).

**API:** `GET /consultations/:id`

---

### 3.5 HistoryScreen (modified)

**Purpose:** List of past consultations.

**Behavior:**
- `GET /consultations/my` on mount.
- List items: date, doctor name, diagnosis (if completed), status badge (pending / in_progress / completed / cancelled).
- Tap completed item → PrescriptionScreen.
- Tap in_progress item → ConsultationScreen (resume).
- Empty state: "No tienes consultas anteriores".

**API:** `GET /consultations/my`

---

## 4. State Management

### consultationStore (new Zustand store)

```ts
interface ConsultationState {
  activeConsultationId: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | null
  messages: Message[]
  setActive: (id: string, status: string) => void
  appendMessage: (msg: Message) => void
  setStatus: (status: string) => void
  clear: () => void
}
```

Persisted to AsyncStorage under key `active_consultation`. Cleared on `clear()` in two cases: (1) patient cancels from WaitingScreen, (2) patient navigates back from PrescriptionScreen after viewing a completed consultation. HomeScreen checks store on mount and redirects if non-null.

---

## 5. Socket Service

**File:** `apps/mobile/src/lib/socket.ts`

- Singleton `socket.io-client` instance.
- Connects with `auth: { token }` on login (called from authStore.login).
- Disconnects on logout.
- Exported as `socketService` with `connect()`, `disconnect()`, `emit()`, `on()`, `off()`.
- Screens use `socketService` directly — no React context wrapper needed for MVP.

---

## 6. Server Change Required

**File:** `packages/api/src/sockets/consultation.ts`

Add `status_changed` broadcast when consultation status changes. This requires hooking into the accept/complete/cancel REST endpoints OR adding a socket event handler that the server emits after DB update.

Simplest approach: after `PUT /:id/accept` and `PUT /:id/complete` succeed in the REST handler, emit to the consultation room:

```ts
io.to(consultationId).emit('status_changed', { consultation_id, status })
```

This requires passing the `io` instance to the consultation router (already a pattern in the codebase via service injection).

---

## 7. i18n Keys Required

New keys needed in `es.json` and `en.json`:

```
consultation.start_cta
consultation.symptoms_placeholder
consultation.symptoms_counter
consultation.add_photo
consultation.doctors_available (one/other)
consultation.no_doctors
consultation.waiting_title
consultation.waiting_subtitle
consultation.cancel
consultation.chat_placeholder
consultation.prescription_title
consultation.diagnosis
consultation.medications
consultation.valid_days
consultation.share
history.empty
history.status.pending
history.status.in_progress
history.status.completed
history.status.cancelled
```

---

## 8. Files Changed

| Action | File |
|--------|------|
| NEW | `apps/mobile/src/store/consultationStore.ts` |
| NEW | `apps/mobile/src/lib/socket.ts` |
| NEW | `apps/mobile/src/screens/patient/WaitingScreen.tsx` |
| NEW | `apps/mobile/src/screens/patient/ConsultationScreen.tsx` |
| NEW | `apps/mobile/src/screens/patient/PrescriptionScreen.tsx` |
| MOD | `apps/mobile/src/screens/patient/HomeScreen.tsx` |
| MOD | `apps/mobile/src/screens/patient/HistoryScreen.tsx` |
| MOD | `apps/mobile/src/navigation/RootNavigator.tsx` |
| MOD | `packages/api/src/sockets/consultation.ts` |
| MOD | `apps/mobile/src/i18n/es.json` |
| MOD | `apps/mobile/src/i18n/en.json` |

---

## 9. Out of Scope (Phase 1)

- Push notifications (WhatsApp fallback per PRD)
- Photo sending in chat (text only for MVP)
- Offline mode
- Rating doctor after consultation
- Video call
