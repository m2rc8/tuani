# Push Notifications — Design Spec

**Date:** 2026-05-06
**Project:** MédicoYa
**Scope:** Phase 2 — Expo push notifications via FCM for all key consultation events.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Push provider | Expo Push API (`expo-server-sdk` on backend) → FCM under the hood |
| Token storage | Separate `PushToken` table (supports multiple devices per user) |
| Architecture | `NotificationService` class injected as dep into `createApp()` |
| Events | 5: new consultation, accepted, completed, new message, 2-min reminder |
| Reminder strategy | Cron queries `created_at` window (2–3 min ago) — no tracking field needed |
| Localization | `preferred_language` on User drives ES/EN notification strings |
| Deep linking | Out of scope — tap opens app to last screen |
| Mobile setup | `notifications.ts` called from `App.tsx` after hydrate, role check |

---

## 2. Architecture

### Files changed

| Action | File |
|--------|------|
| MOD | `packages/api/prisma/schema.prisma` |
| NEW | `packages/api/prisma/migrations/<timestamp>_add_push_tokens/migration.sql` |
| NEW | `packages/api/src/services/NotificationService.ts` |
| NEW | `packages/api/src/services/NotificationService.test.ts` |
| MOD | `packages/api/src/services/ConsultationService.ts` |
| MOD | `packages/api/src/sockets/consultation.ts` |
| NEW | `packages/api/src/routes/notifications.ts` |
| NEW | `packages/api/src/routes/notifications.test.ts` |
| MOD | `packages/api/src/app.ts` |
| NEW | `apps/mobile/src/lib/notifications.ts` |
| MOD | `apps/mobile/src/App.tsx` |

---

## 3. Data Model

### `PushToken` model (add to `schema.prisma`)

```prisma
model PushToken {
  id         String   @id @default(uuid())
  user_id    String
  token      String   @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  user User @relation(fields: [user_id], references: [id])
}
```

Add relation field to `User` model:
```prisma
pushTokens PushToken[]
```

### Migration SQL

```sql
CREATE TABLE "PushToken" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "user_id"    TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "token"      TEXT NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "PushToken_user_id_idx" ON "PushToken"("user_id");
```

---

## 4. API Endpoint — POST /api/notifications/token

File: `packages/api/src/routes/notifications.ts`

- `requireAuth` middleware
- Body: `{ token: string }` — validated with zod (`z.string().min(1)`)
- Upsert: if `token` exists in DB for a different user, reassign to current user (shared device edge case). If same user, update `updated_at`.
- Implementation:

```typescript
await db.pushToken.upsert({
  where:  { token: body.token },
  create: { id: randomUUID(), user_id: req.user!.sub, token: body.token },
  update: { user_id: req.user!.sub, updated_at: new Date() },
})
res.status(204).send()
```

### Tests (4 cases)

1. `401` without auth
2. `400` with missing/empty token
3. `204` creates new token for user
4. `204` reassigns existing token to new user (shared device)

---

## 5. NotificationService

File: `packages/api/src/services/NotificationService.ts`

```typescript
import Expo, { ExpoPushMessage } from 'expo-server-sdk'

interface NotifMessage { title: string; body: string }
interface LocalizedMessage { es: NotifMessage; en: NotifMessage }

export class NotificationService {
  private expo = new Expo()

  constructor(private db: PrismaClient) {}

  async sendToUser(userId: string, msg: LocalizedMessage): Promise<void>
  async sendToUsers(userIds: string[], msg: LocalizedMessage): Promise<void>
  private async send(tokens: PushToken[], msg: LocalizedMessage): Promise<void>
}
```

**`send()` implementation:**
1. Build `ExpoPushMessage[]` — one per token, using `user.preferred_language` to select ES/EN string
2. Filter invalid tokens with `Expo.isExpoPushToken(token.token)`
3. Call `expo.sendPushNotificationsAsync(messages)` — fire-and-forget (log errors, don't throw)
4. For `ExpoPushTicket` errors with `details.error === 'DeviceNotRegistered'`: delete the stale token from DB

**`sendToUsers()` fetches tokens in one query:**
```typescript
db.pushToken.findMany({ where: { user_id: { in: userIds } }, include: { user: { select: { preferred_language: true } } } })
```

### Tests (3 cases)

1. Sends push to user's token with correct localized string
2. Filters invalid Expo tokens silently
3. Deletes token on `DeviceNotRegistered` error

---

## 6. Notification Events

### 6.1 New consultation → all available doctors

**Trigger:** `ConsultationService.createConsultation()` after consultation created.

**Recipients:** All doctors where `available = true AND approved_at IS NOT NULL`.

**Message:**
```
ES: title "Nueva consulta", body "Un paciente necesita atención."
EN: title "New consultation", body "A patient needs attention."
```

**Implementation:** Add `notificationService` to `ConsultationService` constructor deps. After `db.consultation.create()`, call:
```typescript
const doctors = await this.db.doctor.findMany({
  where: { available: true, approved_at: { not: null } },
  select: { id: true },
})
await this.notificationService.sendToUsers(doctors.map(d => d.id), NEW_CONSULTATION_MSG)
```

### 6.2 Consultation accepted → patient

**Trigger:** `PUT /api/consultations/:id/accept` route handler, after `consultationService.acceptConsultation()`.

**Recipients:** `consultation.patient.user_id` (the patient's user ID).

**Message:**
```
ES: title "Médico asignado", body "Un médico aceptó tu consulta. Entra al chat."
EN: title "Doctor assigned", body "A doctor accepted your consultation. Join the chat."
```

**Implementation:** In `consultations.ts` route handler after `acceptConsultation()`, call:
```typescript
await notificationService.sendToUser(consultation.patient_id, ACCEPTED_MSG)
```

### 6.3 Consultation completed → patient

**Trigger:** `ConsultationService.completeConsultation()` after prescription created.

**Recipients:** `consultation.patient_id`.

**Message:**
```
ES: title "Receta lista", body "Tu consulta finalizó. Revisa tu receta."
EN: title "Prescription ready", body "Your consultation is complete. View your prescription."
```

### 6.4 New chat message → other party

**Trigger:** `sockets/consultation.ts` `send_message` handler, after message saved to DB.

**Recipients:** The other party — if sender is doctor, notify patient; if sender is patient, notify doctor.

**Message:**
```
ES: title "Nuevo mensaje", body "Tienes un mensaje en tu consulta."
EN: title "New message", body "You have a new message in your consultation."
```

**Implementation:** After `io.to(consultationId).emit('receive_message', ...)`, look up `consultation.patient_id` and `consultation.doctor_id` from the saved message's consultation. Determine recipient: `senderId === consultation.patient_id ? consultation.doctor_id : consultation.patient_id`. Call `notificationService.sendToUser(recipientId, NEW_MESSAGE_MSG)`. The recipient may not have the app open — if they do, the OS suppresses the notification (handled by Expo foreground handler).

### 6.5 2-min missed queue reminder → all available doctors

**Trigger:** `node-cron` job, schedule `* * * * *` (every minute).

**Query:**
```typescript
const twoMinAgo  = new Date(Date.now() - 2 * 60 * 1000)
const threeMinAgo = new Date(Date.now() - 3 * 60 * 1000)
const pending = await db.consultation.findMany({
  where: {
    status:     ConsultationStatus.pending,
    created_at: { gte: threeMinAgo, lt: twoMinAgo },
  },
  select: { id: true },
})
```

If `pending.length > 0`: send to all available+approved doctors (same query as 6.1).

**Message:**
```
ES: title "Consulta sin atender", body "Hay pacientes esperando respuesta."
EN: title "Unanswered consultation", body "Patients are waiting for a response."
```

**Cron setup** in `app.ts`:
```typescript
import cron from 'node-cron'
cron.schedule('* * * * *', () => notificationService.sendMissedQueueReminder())
```

`sendMissedQueueReminder()` is a method on `NotificationService` — keeps cron logic inside the service, testable.

---

## 7. Mobile Client

### `apps/mobile/src/lib/notifications.ts`

```typescript
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import api from './api'

export async function registerForPushNotifications(): Promise<void> {
  // Physical device check
  if (!Constants.isDevice) return

  // Permission request
  const { status: existing } = await Notifications.getPermissionsAsync()
  const { status } = existing === 'granted'
    ? { status: existing }
    : await Notifications.requestPermissionsAsync()
  if (status !== 'granted') return

  // Android channel (required for Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    })
  }

  // Get token and register with backend
  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
  await api.post('/api/notifications/token', { token }).catch(() => {})
}
```

### `apps/mobile/src/App.tsx` changes

1. Add `Notifications.setNotificationHandler` at module level (show alerts in foreground):

```typescript
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
})
```

2. In the `init()` function (after `authStore.hydrate()`), if `role` is set:

```typescript
if (authStore.getState().role) {
  registerForPushNotifications().catch(() => {})
}
```

---

## 8. Dependency Changes

### Backend (`packages/api/package.json`)

```
expo-server-sdk   ^3.x   (Expo push API client)
node-cron         ^3.x   (cron scheduler)
@types/node-cron  ^3.x   (dev)
```

### Mobile (`apps/mobile/package.json`)

```
expo-notifications   (install via: npx expo install expo-notifications)
```

`expo-constants` is already installed (comes with Expo).

---

## 9. `createApp()` changes

`NotificationService` injected as optional dep (so tests can pass a mock or `undefined`):

```typescript
interface AppDeps {
  // ... existing ...
  notificationService?: NotificationService
}

// Default: create with prisma
const notificationService = deps?.notificationService ?? new NotificationService(db)
```

Passed to:
- `ConsultationService` constructor
- `createConsultationsRouter(consultationService, uploadService, notificationService)`
- `createNotificationsRouter(db)` (new route)
- Cron job

---

## 10. Out of Scope

- Deep link on notification tap (tap opens app to last screen)
- Read receipts or notification badges
- Unsubscribe / notification preferences per user
- Web push for admin panel
- FCM topic subscriptions
