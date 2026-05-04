# MédicoYa — Sub-proyecto 2: Backend API (Consultas, Chat, Recetas, Fotos)

**Fecha:** 2026-05-04
**Estado:** Aprobado
**Fase PRD:** Fase 1 MVP
**Scope:** Backend API completo — consultas, chat Socket.io, recetas QR, fotos Cloudinary, FHIR R4 read endpoints

---

## Decisiones técnicas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Statuses de consulta | `pending→active→completed\|rejected\|cancelled` | Audit trail sin complejidad de `expired` (cron diferido a Fase 2) |
| Upload de fotos | Server-side Cloudinary (multer memoryStorage) | Credenciales nunca salen del servidor |
| Auth WebSocket | JWT handshake + room participant check | Identidad + previene eavesdropping por consultation_id |
| Socket.io ↔ REST | `io` opcional en `ConsultationService` | Tests sin mock, production con eventos reales |
| QR text | `MEDICOYA:<qr_code>` | Prefijo para escaneo identificable en futuro |
| Expiry cron | Query-time filter (`valid_until < now()`) | Sin cron en MVP, diferido a Fase 2 |
| QR ID | `crypto.randomBytes(7).toString('base64url').slice(0, 10)` | Node built-in, CJS-safe, evita nanoid v5 ESM conflict |
| FHIR | R4 read-only endpoints (`/fhir/R4/`) | Interoperabilidad con SESAL y sistemas hospitalarios desde Fase 1 sin costo de migración posterior |
| FHIR serialización | Mappers manuales en `lib/fhir.ts` | 4 recursos, sin librería externa, types locales |

---

## Estructura de archivos

```
packages/api/
├── prisma/
│   └── schema.prisma              ← MODIFY: add Consultation, Message, Prescription + back-relations
├── src/
│   ├── lib/
│   │   ├── cloudinary.ts          ← NEW: upload helper (server-side stream)
│   │   ├── fhir.ts                ← NEW: FHIR R4 resource mappers
│   │   ├── prisma.ts              (unchanged)
│   │   └── twilio.ts              (unchanged)
│   ├── middleware/
│   │   └── requireAuth.ts         (unchanged)
│   ├── routes/
│   │   ├── auth.ts                (unchanged)
│   │   ├── consultations.ts       ← NEW
│   │   ├── doctors.ts             ← NEW
│   │   ├── fhir.ts                ← NEW: /fhir/R4/ read endpoints
│   │   ├── prescriptions.ts       ← NEW
│   │   └── admin.ts               ← NEW
│   ├── services/
│   │   ├── AuthService.ts         (unchanged)
│   │   ├── OtpService.ts          (unchanged)
│   │   ├── ConsultationService.ts ← NEW
│   │   ├── PrescriptionService.ts ← NEW
│   │   └── UploadService.ts       ← NEW
│   ├── sockets/
│   │   └── consultation.ts        ← NEW: Socket.io event handlers
│   ├── app.ts                     ← MODIFY: new routes, returns { app, server }
│   ├── server.ts                  ← MODIFY: http.Server + io attach
│   └── test-setup.ts              (unchanged)
```

`app.ts` cambia firma: `createApp(deps?) → { app: Express }` (ya no retorna server).
`server.ts` crea `http.Server` bare primero, luego `io`, luego llama `createApp({ io })`, luego `httpServer.on('request', app)`. Evita dependencia circular entre Express app y Socket.io server.

---

## Prisma Schema — modelos nuevos

Agregar al schema existente (mantener User, Doctor, Patient, enums existentes):

```prisma
enum ConsultationStatus {
  pending
  active
  completed
  rejected
  cancelled
}

enum MessageType {
  text
  image
}

enum PaymentStatus {
  pending
  confirmed
}

model Consultation {
  id             String             @id @default(uuid())
  patient_id     String
  doctor_id      String?
  status         ConsultationStatus @default(pending)
  symptoms_text  String?
  symptom_photo  String?
  diagnosis      String?
  diagnosis_code String?
  price_lps      Decimal?           @db.Decimal(10, 2)
  payment_status PaymentStatus      @default(pending)
  created_at     DateTime           @default(now())
  completed_at   DateTime?

  patient      Patient       @relation(fields: [patient_id], references: [id])
  doctor       Doctor?       @relation(fields: [doctor_id], references: [id])
  messages     Message[]
  prescription Prescription?
}

model Message {
  id              String      @id @default(uuid())
  consultation_id String
  sender_id       String
  content         String
  msg_type        MessageType @default(text)
  created_at      DateTime    @default(now())

  consultation Consultation @relation(fields: [consultation_id], references: [id])
  sender       User         @relation(fields: [sender_id], references: [id])
}

model Prescription {
  id              String   @id @default(uuid())
  consultation_id String   @unique
  qr_code         String   @unique
  medications     Json
  instructions    String?
  valid_until     DateTime
  created_at      DateTime @default(now())

  consultation Consultation @relation(fields: [consultation_id], references: [id])
}
```

Back-relations agregadas a modelos existentes:

```prisma
// En Doctor:
consultations Consultation[]

// En Patient:
consultations Consultation[]

// En User:
messages Message[]
```

`medications` es un array JSON: `[{ name: string, dose: string, frequency: string, code?: string }]`.
El campo `code` es opcional — RxNorm code (e.g. `"1049502"`) o nombre genérico DCI. Se usa en los mappers FHIR.
`diagnosis_code` es ICD-10 opcional (e.g. `"J06.9"`). Free-text `diagnosis` sigue siendo el campo primario; `diagnosis_code` es el hook FHIR.
`symptom_photo` almacena la URL completa de Cloudinary.
`qr_code` es el código corto de 10 chars — generado con `crypto.randomBytes(7).toString('base64url').slice(0, 10)`. Colisión improbable; `@unique` en DB es la garantía final.

---

## REST Endpoints

### Auth (sin cambios)
```
POST /api/auth/send-otp
POST /api/auth/verify-otp
```

### Doctors
```
GET  /api/doctors/available             requireAuth (any role)
  → Doctor[] con user.name incluido, filtro: available=true AND approved_at IS NOT NULL

PUT  /api/doctors/availability          requireAuth (doctor)
  body: { available: boolean }
  → Doctor actualizado
```

### Consultations
```
POST /api/consultations                 requireAuth (patient)
  body: multipart/form-data
    symptoms_text?: string (max 500 chars)
    photo?: File (max 5MB, jpeg|png|webp)
  → Consultation (status: pending)

GET  /api/consultations/my              requireAuth (any)
  → Consultation[] (últimas 20, ordenadas por created_at desc)
  paciente ve sus consultas; médico ve las suyas

GET  /api/consultations/:id             requireAuth + participant
  → Consultation con messages[] y prescription

PUT  /api/consultations/:id/accept      requireAuth (doctor)
  → Consultation (status: pending→active, doctor_id set)
  → emite consultation_updated al room

PUT  /api/consultations/:id/reject      requireAuth (doctor)
  → Consultation (status: pending→rejected)
  → emite consultation_updated al room

PUT  /api/consultations/:id/cancel      requireAuth (patient|doctor)
  → Consultation (status: pending|active→cancelled)
  → emite consultation_updated al room

PUT  /api/consultations/:id/complete    requireAuth (doctor)
  body: { diagnosis: string, diagnosis_code?: string, medications: Medication[], instructions?: string, price_lps?: number }
  → Prisma transaction: Consultation (status: active→completed, completed_at) + Prescription (qr_code, valid_until=+30d)
  → { consultation, prescription }
  → emite consultation_updated al room

PUT  /api/consultations/:id/payment     requireAuth (doctor)
  → Consultation (payment_status: pending→confirmed)
```

### Prescriptions
```
GET  /api/prescriptions/:id             requireAuth + participant
  → Prescription

GET  /api/prescriptions/:id/qr          requireAuth + participant
  → image/png (QR de "MEDICOYA:<qr_code>")
```

### Admin
```
GET  /api/admin/doctors/pending         requireAuth (admin)
  → Doctor[] donde approved_at IS NULL AND cmh_verified puede ser cualquier valor

PUT  /api/admin/doctors/:id/approve     requireAuth (admin)
  → Doctor (approved_at = now())
```

**Guards de rol:** middleware `requireRole(role: Role)` — helper simple que verifica `req.user.role`.

**Participant check:** helper `assertParticipant(consultation, userId)` — verifica `patient_id === userId || doctor_id === userId`. Lanza error `NOT_PARTICIPANT` → 403.

---

## Capa de servicios

### ConsultationService

```typescript
class ConsultationService {
  constructor(
    private db: PrismaClient,
    private io?: Server  // opcional — undefined en tests, Socket.io Server en prod
  ) {}

  createConsultation(patientId: string, data: {
    symptoms_text?: string
    symptom_photo?: string
  }): Promise<Consultation>

  getConsultation(id: string, userId: string): Promise<Consultation>
  // throws NOT_PARTICIPANT si userId no es patient_id ni doctor_id

  acceptConsultation(id: string, doctorId: string): Promise<Consultation>
  // throws WRONG_STATUS si status !== 'pending'

  rejectConsultation(id: string, doctorId: string): Promise<Consultation>
  // throws WRONG_STATUS si status !== 'pending'

  cancelConsultation(id: string, userId: string): Promise<Consultation>
  // throws WRONG_STATUS si status === 'completed' | 'rejected' | 'cancelled'

  completeConsultation(id: string, doctorId: string, data: {
    diagnosis: string
    diagnosis_code?: string
    medications: Medication[]
    instructions?: string
    price_lps?: number
  }): Promise<{ consultation: Consultation; prescription: Prescription }>
  // Prisma $transaction: update Consultation + create Prescription
  // throws WRONG_STATUS si status !== 'active'

  confirmPayment(id: string, doctorId: string): Promise<Consultation>

  getUserConsultations(userId: string, role: Role): Promise<Consultation[]>
  // patient: where patient_id; doctor: where doctor_id; últimas 20
}
```

Errores de dominio:

```typescript
export class ConsultationError extends Error {
  constructor(public code: 'NOT_FOUND' | 'NOT_PARTICIPANT' | 'WRONG_STATUS' | 'WRONG_ROLE', message: string) {
    super(message)
  }
}
```

Routes mapean `ConsultationError.code` → HTTP status:
- `NOT_FOUND` → 404
- `NOT_PARTICIPANT` → 403
- `WRONG_STATUS` → 409
- `WRONG_ROLE` → 403

### PrescriptionService

```typescript
class PrescriptionService {
  constructor(private db: PrismaClient) {}

  getPrescription(id: string, userId: string): Promise<Prescription>
  // verifica participante via consultation

  getQrPng(id: string, userId: string): Promise<Buffer>
  // qrcode.toBuffer(`MEDICOYA:${prescription.qr_code}`)
}
```

### UploadService

```typescript
class UploadService {
  uploadPhoto(buffer: Buffer, mimetype: string): Promise<string>
  // cloudinary.v2.uploader.upload_stream → retorna secure_url
  // folder: 'medicoya/symptoms'
}
```

En tests: mockeado → retorna `'https://res.cloudinary.com/test/image/upload/test.jpg'`.

---

## Socket.io

### Configuración servidor

```typescript
// server.ts
import 'dotenv/config'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createApp } from './app'
import { registerConsultationHandlers } from './sockets/consultation'
import { prisma } from './lib/prisma'

// Bare http.Server first → io → app → wire together (avoids circular dep)
const httpServer = createServer()
const io = new Server(httpServer, { cors: { origin: '*' } })
const { app } = createApp({ io })
httpServer.on('request', app)

registerConsultationHandlers(io, prisma)

const PORT = parseInt(process.env.PORT ?? '3000', 10)
httpServer.listen(PORT, () => console.log(`MédicoYa API on port ${PORT}`))
```

### Auth middleware WebSocket

```typescript
io.use((socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token) return next(new Error('UNAUTHORIZED'))
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    socket.data.user = { sub: payload.sub, role: payload.role, preferred_language: payload.preferred_language }
    next()
  } catch {
    next(new Error('UNAUTHORIZED'))
  }
})
```

### Eventos

**Client → Server:**

| Evento | Payload | Acción |
|--------|---------|--------|
| `join_consultation` | `{ consultation_id: string }` | Verifica en DB que socket.data.user.sub es patient_id o doctor_id. Si OK: `socket.join(consultation_id)`. Si no: emite `error { code: 'NOT_PARTICIPANT' }`. |
| `send_message` | `{ consultation_id: string, content: string, msg_type: 'text'\|'image' }` | Verifica participante. Guarda `Message` en DB. Emite `receive_message` a room `consultation_id`. |

**Server → Client:**

| Evento | Payload | Cuándo |
|--------|---------|--------|
| `receive_message` | `{ id, sender_id, content, msg_type, created_at }` | Al procesar `send_message` |
| `consultation_updated` | `{ id, status }` | Al cambiar status vía REST (accept/reject/cancel/complete) |
| `error` | `{ code: string, message: string }` | Cualquier error en handler |

### Integración REST → Socket.io

`ConsultationService` acepta `io?: Server`. Al emitir:

```typescript
this.io?.to(consultationId).emit('consultation_updated', { id, status })
```

`createApp(deps?)` acepta `io` en deps y lo pasa a `ConsultationService`:

```typescript
interface AppDeps {
  authService?: AuthService
  consultationService?: ConsultationService
  prescriptionService?: PrescriptionService
  uploadService?: UploadService
  io?: Server
}
```

---

## FHIR R4

### Endpoints

```
GET /fhir/R4/Encounter/:id            requireAuth + participant  → FHIR Encounter
GET /fhir/R4/Patient/:id              requireAuth               → FHIR Patient
GET /fhir/R4/Practitioner/:id         requireAuth               → FHIR Practitioner
GET /fhir/R4/MedicationRequest/:id    requireAuth + participant  → FHIR Bundle (collection)
```

Todos retornan `Content-Type: application/fhir+json`.  
`/:id` en todos los endpoints es el UUID interno de MédicoYa (mismo id que el recurso FHIR).

`GET /fhir/R4/Patient/:id` — acceso: el propio paciente (`req.user.sub === id`) o un médico con consulta activa/completada contra ese paciente. Si ninguna condición se cumple → 403.

### lib/fhir.ts — Mappers

Tipos locales mínimos (sin librería externa):

```typescript
type FhirStatus = 'planned' | 'in-progress' | 'finished' | 'cancelled'

// Consultation.status → FHIR Encounter.status
const ENCOUNTER_STATUS: Record<ConsultationStatus, FhirStatus> = {
  pending:   'planned',
  active:    'in-progress',
  completed: 'finished',
  rejected:  'cancelled',
  cancelled: 'cancelled',
}
```

**toFhirEncounter(consultation)**

```typescript
{
  resourceType: 'Encounter',
  id: consultation.id,
  status: ENCOUNTER_STATUS[consultation.status],
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'VR',
    display: 'virtual',
  },
  subject: { reference: `Patient/${consultation.patient_id}` },
  ...(consultation.doctor_id && {
    participant: [{ individual: { reference: `Practitioner/${consultation.doctor_id}` } }],
  }),
  ...(consultation.diagnosis && {
    reasonCode: [{
      coding: [{
        system: 'http://hl7.org/fhir/sid/icd-10',
        ...(consultation.diagnosis_code && { code: consultation.diagnosis_code }),
        display: consultation.diagnosis,
      }],
      text: consultation.diagnosis,
    }],
  }),
  period: {
    start: consultation.created_at.toISOString(),
    ...(consultation.completed_at && { end: consultation.completed_at.toISOString() }),
  },
}
```

**toFhirPatient(user, patient)**

```typescript
{
  resourceType: 'Patient',
  id: patient.id,
  telecom: [{ system: 'phone', value: user.phone, use: 'mobile' }],
  ...(user.name && { name: [{ text: user.name }] }),
  ...(patient.dob && { birthDate: patient.dob.toISOString().split('T')[0] }),
  communication: [{
    language: {
      coding: [{ system: 'urn:ietf:bcp:47', code: user.preferred_language }],
    },
    preferred: true,
  }],
}
```

**toFhirPractitioner(user, doctor)**

```typescript
{
  resourceType: 'Practitioner',
  id: doctor.id,
  telecom: [{ system: 'phone', value: user.phone }],
  ...(user.name && { name: [{ text: user.name }] }),
  ...(doctor.cedula && {
    identifier: [{
      system: 'urn:oid:2.16.840.1.113883.2.341.1',  // Honduras CMH — OID placeholder Fase 3
      value: doctor.cedula,
    }],
  }),
}
```

**toFhirMedicationBundle(prescription, patientId)**

Retorna `Bundle` con un `MedicationRequest` por medicamento:

```typescript
{
  resourceType: 'Bundle',
  type: 'collection',
  entry: (prescription.medications as Medication[]).map((med, i) => ({
    resource: {
      resourceType: 'MedicationRequest',
      id: `${prescription.id}-${i}`,
      status: new Date() <= prescription.valid_until ? 'active' : 'completed',
      intent: 'order',
      medicationCodeableConcept: {
        coding: [{
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          ...(med.code && { code: med.code }),
          display: med.name,
        }],
        text: med.name,
      },
      subject: { reference: `Patient/${patientId}` },
      dosageInstruction: [{ text: `${med.dose} — ${med.frequency}` }],
      dispenseRequest: {
        validityPeriod: { end: prescription.valid_until.toISOString().split('T')[0] },
      },
    },
  })),
}
```

### routes/fhir.ts

```typescript
export function createFhirRouter(db: PrismaClient): Router {
  const router = Router()

  router.get('/Encounter/:id', requireAuth, async (req, res) => {
    // fetch consultation + assertParticipant
    // return toFhirEncounter(consultation)
  })

  router.get('/Patient/:id', requireAuth, async (req, res) => {
    // fetch user + patient
    // check: req.user.sub === id OR doctor with shared consultation
    // return toFhirPatient(user, patient)
  })

  router.get('/Practitioner/:id', requireAuth, async (req, res) => {
    // fetch user + doctor
    // return toFhirPractitioner(user, doctor)
  })

  router.get('/MedicationRequest/:id', requireAuth, async (req, res) => {
    // fetch prescription + assertParticipant via consultation
    // return toFhirMedicationBundle(prescription, patientId)
  })

  return router
}
```

Montado en `app.ts`:
```typescript
app.use('/fhir/R4', createFhirRouter(db))
```

---

## lib/cloudinary.ts

```typescript
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export function uploadStream(buffer: Buffer, folder: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'))
        resolve(result.secure_url)
      }
    )
    stream.end(buffer)
  })
}
```

---

## Variables de entorno requeridas (nuevas)

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Dependencias nuevas (packages/api)

```json
{
  "dependencies": {
    "cloudinary": "^2",
    "multer": "^1",
    "qrcode": "^1",
    "socket.io": "^4"
  },
  "devDependencies": {
    "@types/multer": "^1",
    "@types/qrcode": "^1"
  }
}
```

`nanoid` eliminado — se usa `crypto.randomBytes` de Node built-in (CJS-safe, sin dependencia extra).

---

## Criterios de aceptación (Definition of Done)

- [ ] `prisma migrate dev` crea tablas `consultations`, `messages`, `prescriptions` sin errores
- [ ] `GET /api/doctors/available` retorna lista de médicos disponibles (requireAuth)
- [ ] `POST /api/consultations` con foto retorna Consultation con `symptom_photo` URL
- [ ] `POST /api/consultations` sin foto retorna Consultation con `symptom_photo: null`
- [ ] `PUT /api/consultations/:id/accept` cambia status a `active`, rechaza si ya `active`
- [ ] `PUT /api/consultations/:id/complete` crea Prescription en misma transacción
- [ ] `GET /api/prescriptions/:id/qr` retorna PNG válido con Content-Type `image/png`
- [ ] Socket.io: cliente sin JWT no puede conectar (error `UNAUTHORIZED`)
- [ ] Socket.io: cliente no participante no puede hacer `join_consultation` (error `NOT_PARTICIPANT`)
- [ ] Socket.io: `send_message` persiste en DB y llega a ambos participantes del room
- [ ] `consultation_updated` se emite vía Socket.io al aceptar/rechazar/completar consulta
- [ ] `GET /api/admin/doctors/pending` rechaza request con role `patient` o `doctor` (403)
- [ ] `GET /fhir/R4/Encounter/:id` retorna JSON con `resourceType: "Encounter"` y `Content-Type: application/fhir+json`
- [ ] `GET /fhir/R4/Encounter/:id` mapea status `active` → `"in-progress"`, `completed` → `"finished"`
- [ ] `GET /fhir/R4/Patient/:id` retorna FHIR Patient con `telecom[phone]` y `communication[preferred_language]`
- [ ] `GET /fhir/R4/Practitioner/:id` retorna FHIR Practitioner con `identifier[cedula]` si existe
- [ ] `GET /fhir/R4/MedicationRequest/:id` retorna Bundle con un entry por medicamento
- [ ] FHIR endpoints respetan participant check — no participante recibe 403
- [ ] TypeScript compila sin errores (`tsc --noEmit`)

---

## Lo que NO incluye este sub-proyecto

- App móvil (Sub-proyectos 3 y 4)
- Admin panel web (Sub-proyecto 5)
- Videollamada (Fase 2)
- Pagos automáticos Tigo Money (Fase 2)
- Redis adapter para Socket.io (Fase 2)
- Cron de expiración de recetas (Fase 2)
- Push notifications (Fase 2)
- Rating de médicos (Fase 2)
- FHIR write endpoints (create/update) — Fase 3
- FHIR search parameters (`?subject=Patient/id`) — Fase 3
- FHIR CapabilityStatement — Fase 3
- OID oficial Honduras CMH — requiere coordinación con SESAL, Fase 3

---

## Sub-proyectos siguientes

| # | Scope | Depende de |
|---|-------|------------|
| 3 | App móvil paciente (Expo) | Sub-proyecto 2 |
| 4 | App móvil médico (Expo) | Sub-proyecto 2 |
| 5 | Admin panel | Sub-proyecto 2 |
