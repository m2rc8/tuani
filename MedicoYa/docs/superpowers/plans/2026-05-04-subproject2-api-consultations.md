# Sub-proyecto 2: Backend API Consultations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete backend REST + Socket.io API for consultations, prescriptions, photo uploads, and FHIR R4 read endpoints on top of the existing Sub-proyecto 1 auth scaffold.

**Architecture:** Extend the existing service-layer pattern (`ConsultationService`, `PrescriptionService`, `UploadService`) injected via `createApp(deps?)`. Socket.io attaches to a bare `http.Server` (created before Express) to avoid circular dependencies. FHIR R4 read endpoints are plain mapper functions in `lib/fhir.ts` — no external FHIR library.

**Tech Stack:** TypeScript 5, Express 4, Prisma 5 (PostgreSQL), Socket.io 4, Cloudinary SDK v2, multer (memory storage), qrcode, Vitest + supertest + socket.io-client.

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/api/prisma/schema.prisma` | MODIFY | Add Consultation, Message, Prescription models + back-relations |
| `packages/api/package.json` | MODIFY | Add cloudinary, multer, qrcode, socket.io + dev types |
| `packages/api/src/services/ConsultationService.ts` | CREATE | All consultation business logic + ConsultationError |
| `packages/api/src/services/ConsultationService.test.ts` | CREATE | Unit tests with mock Prisma |
| `packages/api/src/services/UploadService.ts` | CREATE | Cloudinary upload wrapper |
| `packages/api/src/services/UploadService.test.ts` | CREATE | Unit tests with mock cloudinary lib |
| `packages/api/src/services/PrescriptionService.ts` | CREATE | getPrescription + getQrPng |
| `packages/api/src/services/PrescriptionService.test.ts` | CREATE | Unit tests with mock Prisma + mock qrcode |
| `packages/api/src/lib/cloudinary.ts` | CREATE | uploadStream helper (server-side Cloudinary) |
| `packages/api/src/lib/fhir.ts` | CREATE | FHIR R4 resource mapper functions |
| `packages/api/src/lib/fhir.test.ts` | CREATE | Pure unit tests for mappers |
| `packages/api/src/middleware/requireAuth.ts` | MODIFY | Add requireRole() factory export |
| `packages/api/src/middleware/requireAuth.test.ts` | MODIFY | Add requireRole tests |
| `packages/api/src/routes/doctors.ts` | CREATE | GET /available, PUT /availability |
| `packages/api/src/routes/admin.ts` | CREATE | GET /doctors/pending, PUT /doctors/:id/approve |
| `packages/api/src/routes/consultations.ts` | CREATE | Full consultation CRUD + state transitions |
| `packages/api/src/routes/prescriptions.ts` | CREATE | GET prescription + QR PNG |
| `packages/api/src/routes/fhir.ts` | CREATE | GET /fhir/R4/ endpoints |
| `packages/api/src/routes/doctors.test.ts` | CREATE | Integration tests via createApp |
| `packages/api/src/routes/admin.test.ts` | CREATE | Integration tests via createApp |
| `packages/api/src/routes/consultations.test.ts` | CREATE | Integration tests via createApp |
| `packages/api/src/routes/prescriptions.test.ts` | CREATE | Integration tests via createApp |
| `packages/api/src/routes/fhir.test.ts` | CREATE | Integration tests via createApp |
| `packages/api/src/sockets/consultation.ts` | CREATE | Socket.io JWT auth + join/message handlers |
| `packages/api/src/sockets/consultation.test.ts` | CREATE | Integration tests with socket.io-client |
| `packages/api/src/app.ts` | MODIFY | Add new deps interface + mount new routes |
| `packages/api/src/server.ts` | MODIFY | bare http.Server → io → createApp → wire |
| `packages/api/src/routes/auth.test.ts` | MODIFY | Update makeTestApp for new createApp return type |

---

## Task 1: Install dependencies + Prisma schema migration

**Files:**
- Modify: `packages/api/package.json`
- Modify: `packages/api/prisma/schema.prisma`

- [ ] **Step 1: Install new production dependencies**

Run from repo root:
```bash
npm install --workspace packages/api cloudinary@^2 multer@^1 qrcode@^1 socket.io@^4
```

- [ ] **Step 2: Install new dev dependencies**

```bash
npm install --workspace packages/api --save-dev @types/multer@^1 @types/qrcode@^1 socket.io-client@^4
```

- [ ] **Step 3: Verify package.json updated**

Run: `cat packages/api/package.json`
Expected: `cloudinary`, `multer`, `qrcode`, `socket.io` in `dependencies`; `@types/multer`, `@types/qrcode`, `socket.io-client` in `devDependencies`.

- [ ] **Step 4: Replace prisma/schema.prisma with full updated schema**

Write the complete file `packages/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                 String    @id @default(uuid())
  phone              String    @unique
  name               String?
  role               Role
  preferred_language Language  @default(es)
  created_at         DateTime  @default(now())

  doctor   Doctor?
  patient  Patient?
  messages Message[]
}

enum Role {
  patient
  doctor
  admin
}

enum Language {
  es
  en
}

model Doctor {
  id           String    @id
  user         User      @relation(fields: [id], references: [id])
  cedula       String?   @unique
  cmh_verified Boolean   @default(false)
  available    Boolean   @default(false)
  bio          String?
  approved_at  DateTime?

  consultations Consultation[]
}

model Patient {
  id                String           @id
  user              User             @relation(fields: [id], references: [id])
  dob               DateTime?
  allergies         String?
  registered_by     String?
  registration_mode RegistrationMode @default(self)

  consultations Consultation[]
}

enum RegistrationMode {
  self
  brigade_doctor
}

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

- [ ] **Step 5: Run migration**

Make sure PostgreSQL is running (Docker or local), then from `packages/api/`:
```bash
npx prisma migrate dev --name add-consultation-message-prescription
```

Expected: Migration created and applied. No errors. Three new tables created.

- [ ] **Step 6: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` message. New types `ConsultationStatus`, `MessageType`, `PaymentStatus`, `Consultation`, `Message`, `Prescription` now available.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 8: Run existing tests to verify nothing broke**

```bash
npm test
```

Expected: 24 tests passing.

- [ ] **Step 9: Commit**

```bash
git add packages/api/package.json packages/api/package-lock.json packages/api/prisma/schema.prisma packages/api/prisma/migrations/
git commit -m "feat: add consultation/message/prescription schema + new deps"
```

---

## Task 2: ConsultationService (TDD)

**Files:**
- Create: `packages/api/src/services/ConsultationService.test.ts`
- Create: `packages/api/src/services/ConsultationService.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/services/ConsultationService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConsultationService, ConsultationError, Medication } from './ConsultationService'
import { ConsultationStatus, PaymentStatus, Role, Language } from '@prisma/client'

const PATIENT_ID = 'patient-uuid-1'
const DOCTOR_ID  = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'
const SECRET     = 'test-secret-medicoya-min-32-chars-ok'

const baseConsultation = {
  id: CONSULT_ID,
  patient_id: PATIENT_ID,
  doctor_id: null,
  status: ConsultationStatus.pending,
  symptoms_text: 'headache',
  symptom_photo: null,
  diagnosis: null,
  diagnosis_code: null,
  price_lps: null,
  payment_status: PaymentStatus.pending,
  created_at: new Date(),
  completed_at: null,
}

const mockDb = {
  consultation: {
    create:     vi.fn(),
    findUnique: vi.fn(),
    update:     vi.fn(),
    findMany:   vi.fn(),
  },
  $transaction: vi.fn(),
}

describe('ConsultationService', () => {
  let svc: ConsultationService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new ConsultationService(mockDb as any)
  })

  describe('createConsultation', () => {
    it('creates consultation with patient_id and symptoms', async () => {
      mockDb.consultation.create.mockResolvedValue({ ...baseConsultation })
      const result = await svc.createConsultation(PATIENT_ID, { symptoms_text: 'headache' })
      expect(mockDb.consultation.create).toHaveBeenCalledWith({
        data: { patient_id: PATIENT_ID, symptoms_text: 'headache', symptom_photo: undefined },
      })
      expect(result.patient_id).toBe(PATIENT_ID)
    })

    it('creates consultation without photo when not provided', async () => {
      mockDb.consultation.create.mockResolvedValue({ ...baseConsultation })
      await svc.createConsultation(PATIENT_ID, {})
      expect(mockDb.consultation.create).toHaveBeenCalledWith({
        data: { patient_id: PATIENT_ID, symptoms_text: undefined, symptom_photo: undefined },
      })
    })
  })

  describe('getConsultation', () => {
    it('returns consultation when user is patient', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      const result = await svc.getConsultation(CONSULT_ID, PATIENT_ID)
      expect(result.id).toBe(CONSULT_ID)
    })

    it('returns consultation when user is doctor', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation, doctor_id: DOCTOR_ID })
      const result = await svc.getConsultation(CONSULT_ID, DOCTOR_ID)
      expect(result.id).toBe(CONSULT_ID)
    })

    it('throws NOT_FOUND when consultation does not exist', async () => {
      mockDb.consultation.findUnique.mockResolvedValue(null)
      await expect(svc.getConsultation(CONSULT_ID, PATIENT_ID)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('throws NOT_PARTICIPANT when user is neither patient nor doctor', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      await expect(svc.getConsultation(CONSULT_ID, 'other-user')).rejects.toMatchObject({ code: 'NOT_PARTICIPANT' })
    })
  })

  describe('acceptConsultation', () => {
    it('sets status to active and doctor_id', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      mockDb.consultation.update.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.active, doctor_id: DOCTOR_ID,
      })
      const result = await svc.acceptConsultation(CONSULT_ID, DOCTOR_ID)
      expect(result.status).toBe(ConsultationStatus.active)
      expect(mockDb.consultation.update).toHaveBeenCalledWith({
        where: { id: CONSULT_ID },
        data:  { status: ConsultationStatus.active, doctor_id: DOCTOR_ID },
      })
    })

    it('throws WRONG_STATUS when consultation is not pending', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.active,
      })
      await expect(svc.acceptConsultation(CONSULT_ID, DOCTOR_ID)).rejects.toMatchObject({ code: 'WRONG_STATUS' })
    })
  })

  describe('rejectConsultation', () => {
    it('sets status to rejected', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      mockDb.consultation.update.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.rejected,
      })
      const result = await svc.rejectConsultation(CONSULT_ID, DOCTOR_ID)
      expect(result.status).toBe(ConsultationStatus.rejected)
    })

    it('throws WRONG_STATUS when not pending', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.completed,
      })
      await expect(svc.rejectConsultation(CONSULT_ID, DOCTOR_ID)).rejects.toMatchObject({ code: 'WRONG_STATUS' })
    })
  })

  describe('cancelConsultation', () => {
    it('sets status to cancelled from pending', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      mockDb.consultation.update.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.cancelled,
      })
      const result = await svc.cancelConsultation(CONSULT_ID, PATIENT_ID)
      expect(result.status).toBe(ConsultationStatus.cancelled)
    })

    it('throws WRONG_STATUS when already completed', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({
        ...baseConsultation, status: ConsultationStatus.completed,
      })
      await expect(svc.cancelConsultation(CONSULT_ID, PATIENT_ID)).rejects.toMatchObject({ code: 'WRONG_STATUS' })
    })
  })

  describe('completeConsultation', () => {
    const meds: Medication[] = [{ name: 'Ibuprofen', dose: '400mg', frequency: 'every 8h' }]

    it('runs $transaction with consultation update + prescription create', async () => {
      const activeConsult = { ...baseConsultation, status: ConsultationStatus.active, doctor_id: DOCTOR_ID }
      mockDb.consultation.findUnique.mockResolvedValue(activeConsult)
      const completedConsult  = { ...activeConsult, status: ConsultationStatus.completed, diagnosis: 'flu' }
      const mockPrescription  = {
        id: 'presc-1', consultation_id: CONSULT_ID, qr_code: 'ABCD123456',
        medications: meds, instructions: null, valid_until: new Date(), created_at: new Date(),
      }
      mockDb.$transaction.mockResolvedValue([completedConsult, mockPrescription])

      const result = await svc.completeConsultation(CONSULT_ID, DOCTOR_ID, { diagnosis: 'flu', medications: meds })
      expect(mockDb.$transaction).toHaveBeenCalled()
      expect(result.consultation.status).toBe(ConsultationStatus.completed)
      expect(result.prescription.qr_code).toBeTruthy()
    })

    it('throws WRONG_STATUS when not active', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({ ...baseConsultation })
      await expect(
        svc.completeConsultation(CONSULT_ID, DOCTOR_ID, { diagnosis: 'flu', medications: meds })
      ).rejects.toMatchObject({ code: 'WRONG_STATUS' })
    })
  })

  describe('confirmPayment', () => {
    it('updates payment_status to confirmed', async () => {
      mockDb.consultation.findUnique.mockResolvedValue({
        ...baseConsultation, doctor_id: DOCTOR_ID, status: ConsultationStatus.completed,
      })
      mockDb.consultation.update.mockResolvedValue({
        ...baseConsultation, payment_status: PaymentStatus.confirmed,
      })
      const result = await svc.confirmPayment(CONSULT_ID, DOCTOR_ID)
      expect(result.payment_status).toBe(PaymentStatus.confirmed)
    })
  })

  describe('getUserConsultations', () => {
    it('queries by patient_id when role is patient', async () => {
      mockDb.consultation.findMany.mockResolvedValue([{ ...baseConsultation }])
      await svc.getUserConsultations(PATIENT_ID, Role.patient)
      expect(mockDb.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patient_id: PATIENT_ID } })
      )
    })

    it('queries by doctor_id when role is doctor', async () => {
      mockDb.consultation.findMany.mockResolvedValue([])
      await svc.getUserConsultations(DOCTOR_ID, Role.doctor)
      expect(mockDb.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { doctor_id: DOCTOR_ID } })
      )
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | tail -20
```

Expected: FAIL with `Cannot find module './ConsultationService'`.

- [ ] **Step 3: Implement ConsultationService**

Create `packages/api/src/services/ConsultationService.ts`:

```typescript
import crypto from 'crypto'
import { PrismaClient, Consultation, Prescription, ConsultationStatus, PaymentStatus, Role } from '@prisma/client'
import type { Server } from 'socket.io'

export interface Medication {
  name: string
  dose: string
  frequency: string
  code?: string
}

interface CompleteData {
  diagnosis: string
  diagnosis_code?: string
  medications: Medication[]
  instructions?: string
  price_lps?: number
}

export class ConsultationError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'NOT_PARTICIPANT' | 'WRONG_STATUS' | 'WRONG_ROLE',
    message: string
  ) {
    super(message)
    this.name = 'ConsultationError'
  }
}

export class ConsultationService {
  constructor(
    private readonly db: PrismaClient,
    private io?: Server
  ) {}

  async createConsultation(
    patientId: string,
    data: { symptoms_text?: string; symptom_photo?: string }
  ): Promise<Consultation> {
    return this.db.consultation.create({
      data: { patient_id: patientId, symptoms_text: data.symptoms_text, symptom_photo: data.symptom_photo },
    })
  }

  async getConsultation(id: string, userId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.patient_id !== userId && c.doctor_id !== userId)
      throw new ConsultationError('NOT_PARTICIPANT', 'Not a participant of this consultation')
    return c
  }

  async acceptConsultation(id: string, doctorId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.status !== ConsultationStatus.pending)
      throw new ConsultationError('WRONG_STATUS', 'Consultation must be pending to accept')
    const updated = await this.db.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.active, doctor_id: doctorId },
    })
    this.io?.to(id).emit('consultation_updated', { id, status: ConsultationStatus.active })
    return updated
  }

  async rejectConsultation(id: string, doctorId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.status !== ConsultationStatus.pending)
      throw new ConsultationError('WRONG_STATUS', 'Consultation must be pending to reject')
    const updated = await this.db.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.rejected },
    })
    this.io?.to(id).emit('consultation_updated', { id, status: ConsultationStatus.rejected })
    return updated
  }

  async cancelConsultation(id: string, userId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    const terminal: ConsultationStatus[] = [
      ConsultationStatus.completed, ConsultationStatus.rejected, ConsultationStatus.cancelled,
    ]
    if (terminal.includes(c.status))
      throw new ConsultationError('WRONG_STATUS', 'Consultation cannot be cancelled in current status')
    const updated = await this.db.consultation.update({
      where: { id },
      data: { status: ConsultationStatus.cancelled },
    })
    this.io?.to(id).emit('consultation_updated', { id, status: ConsultationStatus.cancelled })
    return updated
  }

  async completeConsultation(
    id: string,
    doctorId: string,
    data: CompleteData
  ): Promise<{ consultation: Consultation; prescription: Prescription }> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    if (c.status !== ConsultationStatus.active)
      throw new ConsultationError('WRONG_STATUS', 'Consultation must be active to complete')

    const qr_code    = crypto.randomBytes(7).toString('base64url').slice(0, 10)
    const valid_until = new Date()
    valid_until.setDate(valid_until.getDate() + 30)

    const [consultation, prescription] = await this.db.$transaction([
      this.db.consultation.update({
        where: { id },
        data: {
          status: ConsultationStatus.completed,
          diagnosis: data.diagnosis,
          diagnosis_code: data.diagnosis_code,
          price_lps: data.price_lps,
          completed_at: new Date(),
        },
      }),
      this.db.prescription.create({
        data: {
          consultation_id: id,
          qr_code,
          medications: data.medications,
          instructions: data.instructions,
          valid_until,
        },
      }),
    ])

    this.io?.to(id).emit('consultation_updated', { id, status: ConsultationStatus.completed })
    return { consultation, prescription }
  }

  async confirmPayment(id: string, doctorId: string): Promise<Consultation> {
    const c = await this.db.consultation.findUnique({ where: { id } })
    if (!c) throw new ConsultationError('NOT_FOUND', 'Consultation not found')
    return this.db.consultation.update({
      where: { id },
      data: { payment_status: PaymentStatus.confirmed },
    })
  }

  async getUserConsultations(userId: string, role: Role): Promise<Consultation[]> {
    const where = role === Role.patient ? { patient_id: userId } : { doctor_id: userId }
    return this.db.consultation.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 20,
    })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|✓|×)"
```

Expected: All ConsultationService tests pass. Prior 24 tests still passing.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/ConsultationService.ts packages/api/src/services/ConsultationService.test.ts
git commit -m "feat: add ConsultationService with TDD"
```

---

## Task 3: UploadService + lib/cloudinary.ts (TDD)

**Files:**
- Create: `packages/api/src/lib/cloudinary.ts`
- Create: `packages/api/src/services/UploadService.ts`
- Create: `packages/api/src/services/UploadService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/services/UploadService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UploadService } from './UploadService'

vi.mock('../lib/cloudinary', () => ({
  uploadStream: vi.fn(),
}))

import { uploadStream } from '../lib/cloudinary'

describe('UploadService', () => {
  let svc: UploadService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new UploadService()
  })

  it('returns Cloudinary URL on success', async () => {
    vi.mocked(uploadStream).mockResolvedValue('https://res.cloudinary.com/test/image/upload/v1/test.jpg')
    const url = await svc.uploadPhoto(Buffer.from('fake-image'), 'image/jpeg')
    expect(url).toBe('https://res.cloudinary.com/test/image/upload/v1/test.jpg')
    expect(uploadStream).toHaveBeenCalledWith(Buffer.from('fake-image'), 'medicoya/symptoms')
  })

  it('propagates error when upload fails', async () => {
    vi.mocked(uploadStream).mockRejectedValue(new Error('Upload failed'))
    await expect(svc.uploadPhoto(Buffer.from('bad'), 'image/jpeg')).rejects.toThrow('Upload failed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL with `Cannot find module './UploadService'`.

- [ ] **Step 3: Implement lib/cloudinary.ts**

Create `packages/api/src/lib/cloudinary.ts`:

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

- [ ] **Step 4: Implement UploadService**

Create `packages/api/src/services/UploadService.ts`:

```typescript
import { uploadStream } from '../lib/cloudinary'

export class UploadService {
  async uploadPhoto(buffer: Buffer, mimetype: string): Promise<string> {
    return uploadStream(buffer, 'medicoya/symptoms')
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|UploadService)"
```

Expected: All UploadService tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/lib/cloudinary.ts packages/api/src/services/UploadService.ts packages/api/src/services/UploadService.test.ts
git commit -m "feat: add UploadService + Cloudinary lib"
```

---

## Task 4: PrescriptionService (TDD)

**Files:**
- Create: `packages/api/src/services/PrescriptionService.test.ts`
- Create: `packages/api/src/services/PrescriptionService.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/services/PrescriptionService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrescriptionService } from './PrescriptionService'

vi.mock('qrcode', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-png-data')),
  },
}))

const PATIENT_ID = 'patient-uuid-1'
const DOCTOR_ID  = 'doctor-uuid-1'
const PRESC_ID   = 'presc-uuid-1'
const CONSULT_ID = 'consult-uuid-1'

const mockPrescription = {
  id: PRESC_ID,
  consultation_id: CONSULT_ID,
  qr_code: 'ABC123XYZ0',
  medications: [{ name: 'Paracetamol', dose: '500mg', frequency: 'every 6h' }],
  instructions: 'Take with food',
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  created_at: new Date(),
  consultation: {
    patient_id: PATIENT_ID,
    doctor_id: DOCTOR_ID,
  },
}

const mockDb = {
  prescription: {
    findUnique: vi.fn(),
  },
}

describe('PrescriptionService', () => {
  let svc: PrescriptionService

  beforeEach(() => {
    vi.clearAllMocks()
    svc = new PrescriptionService(mockDb as any)
  })

  describe('getPrescription', () => {
    it('returns prescription for patient', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      const result = await svc.getPrescription(PRESC_ID, PATIENT_ID)
      expect(result.id).toBe(PRESC_ID)
    })

    it('returns prescription for doctor', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      const result = await svc.getPrescription(PRESC_ID, DOCTOR_ID)
      expect(result.id).toBe(PRESC_ID)
    })

    it('throws 404 when not found', async () => {
      mockDb.prescription.findUnique.mockResolvedValue(null)
      await expect(svc.getPrescription(PRESC_ID, PATIENT_ID)).rejects.toThrow('NOT_FOUND')
    })

    it('throws 403 when user is not participant', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      await expect(svc.getPrescription(PRESC_ID, 'other-user')).rejects.toThrow('NOT_PARTICIPANT')
    })
  })

  describe('getQrPng', () => {
    it('returns PNG buffer for valid prescription', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      const buffer = await svc.getQrPng(PRESC_ID, PATIENT_ID)
      expect(Buffer.isBuffer(buffer)).toBe(true)
    })

    it('calls qrcode.toBuffer with MEDICOYA: prefix', async () => {
      mockDb.prescription.findUnique.mockResolvedValue({ ...mockPrescription })
      const QRCode = (await import('qrcode')).default
      await svc.getQrPng(PRESC_ID, PATIENT_ID)
      expect(QRCode.toBuffer).toHaveBeenCalledWith(`MEDICOYA:${mockPrescription.qr_code}`)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL with `Cannot find module './PrescriptionService'`.

- [ ] **Step 3: Implement PrescriptionService**

Create `packages/api/src/services/PrescriptionService.ts`:

```typescript
import QRCode from 'qrcode'
import { PrismaClient, Prescription } from '@prisma/client'

export class PrescriptionError extends Error {
  constructor(public readonly code: 'NOT_FOUND' | 'NOT_PARTICIPANT', message: string) {
    super(message)
    this.name = 'PrescriptionError'
  }
}

export class PrescriptionService {
  constructor(private readonly db: PrismaClient) {}

  async getPrescription(id: string, userId: string): Promise<Prescription> {
    const p = await this.db.prescription.findUnique({
      where: { id },
      include: { consultation: { select: { patient_id: true, doctor_id: true } } },
    })
    if (!p) throw new PrescriptionError('NOT_FOUND', 'Prescription not found')
    const { patient_id, doctor_id } = (p as any).consultation
    if (patient_id !== userId && doctor_id !== userId)
      throw new PrescriptionError('NOT_PARTICIPANT', 'Not a participant of this consultation')
    return p
  }

  async getQrPng(id: string, userId: string): Promise<Buffer> {
    const p = await this.getPrescription(id, userId)
    return QRCode.toBuffer(`MEDICOYA:${p.qr_code}`)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|PrescriptionService)"
```

Expected: All PrescriptionService tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/PrescriptionService.ts packages/api/src/services/PrescriptionService.test.ts
git commit -m "feat: add PrescriptionService with TDD"
```

---

## Task 5: lib/fhir.ts FHIR R4 mappers (TDD)

**Files:**
- Create: `packages/api/src/lib/fhir.test.ts`
- Create: `packages/api/src/lib/fhir.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/lib/fhir.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { toFhirEncounter, toFhirPatient, toFhirPractitioner, toFhirMedicationBundle } from './fhir'
import { ConsultationStatus, Language } from '@prisma/client'

const PATIENT_ID = 'patient-uuid-1'
const DOCTOR_ID  = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'
const PRESC_ID   = 'presc-uuid-1'

const baseConsultation = {
  id: CONSULT_ID,
  patient_id: PATIENT_ID,
  doctor_id: DOCTOR_ID,
  status: ConsultationStatus.active,
  diagnosis: null,
  diagnosis_code: null,
  created_at: new Date('2026-05-04T10:00:00Z'),
  completed_at: null,
}

describe('toFhirEncounter', () => {
  it('maps active consultation to in-progress Encounter', () => {
    const result = toFhirEncounter({ ...baseConsultation })
    expect(result.resourceType).toBe('Encounter')
    expect(result.id).toBe(CONSULT_ID)
    expect(result.status).toBe('in-progress')
    expect(result.subject.reference).toBe(`Patient/${PATIENT_ID}`)
  })

  it('maps completed consultation to finished', () => {
    const result = toFhirEncounter({ ...baseConsultation, status: ConsultationStatus.completed })
    expect(result.status).toBe('finished')
  })

  it('maps pending consultation to planned', () => {
    const result = toFhirEncounter({ ...baseConsultation, status: ConsultationStatus.pending })
    expect(result.status).toBe('planned')
  })

  it('maps rejected/cancelled to cancelled', () => {
    expect(toFhirEncounter({ ...baseConsultation, status: ConsultationStatus.rejected }).status).toBe('cancelled')
    expect(toFhirEncounter({ ...baseConsultation, status: ConsultationStatus.cancelled }).status).toBe('cancelled')
  })

  it('includes participant reference when doctor_id set', () => {
    const result = toFhirEncounter({ ...baseConsultation })
    expect(result.participant?.[0]?.individual?.reference).toBe(`Practitioner/${DOCTOR_ID}`)
  })

  it('includes reasonCode when diagnosis present', () => {
    const result = toFhirEncounter({
      ...baseConsultation, diagnosis: 'Flu', diagnosis_code: 'J10.1',
    })
    expect(result.reasonCode?.[0]?.text).toBe('Flu')
    expect(result.reasonCode?.[0]?.coding?.[0]?.code).toBe('J10.1')
  })

  it('includes period.end when completed_at present', () => {
    const completedAt = new Date('2026-05-04T11:00:00Z')
    const result = toFhirEncounter({ ...baseConsultation, completed_at: completedAt })
    expect(result.period.end).toBe(completedAt.toISOString())
  })
})

describe('toFhirPatient', () => {
  const user    = { phone: '+50499000001', name: 'Ana López', preferred_language: Language.es }
  const patient = { id: PATIENT_ID, dob: new Date('1990-03-15'), allergies: null, registered_by: null, registration_mode: 'self' as const }

  it('maps patient with phone and name', () => {
    const result = toFhirPatient(user as any, patient as any)
    expect(result.resourceType).toBe('Patient')
    expect(result.id).toBe(PATIENT_ID)
    expect(result.telecom[0].value).toBe('+50499000001')
    expect(result.name?.[0]?.text).toBe('Ana López')
  })

  it('includes birthDate when dob present', () => {
    const result = toFhirPatient(user as any, patient as any)
    expect(result.birthDate).toBe('1990-03-15')
  })

  it('includes preferred language in communication', () => {
    const result = toFhirPatient(user as any, patient as any)
    expect(result.communication[0].language.coding[0].code).toBe('es')
  })
})

describe('toFhirPractitioner', () => {
  const user   = { phone: '+50499000002', name: 'Dr. Juan Paz', preferred_language: Language.es }
  const doctor = { id: DOCTOR_ID, cedula: '12345', cmh_verified: true, available: true, bio: null, approved_at: new Date() }

  it('maps practitioner with cedula identifier', () => {
    const result = toFhirPractitioner(user as any, doctor as any)
    expect(result.resourceType).toBe('Practitioner')
    expect(result.id).toBe(DOCTOR_ID)
    expect(result.identifier?.[0]?.value).toBe('12345')
  })

  it('omits identifier when no cedula', () => {
    const result = toFhirPractitioner(user as any, { ...doctor, cedula: null } as any)
    expect(result.identifier).toBeUndefined()
  })
})

describe('toFhirMedicationBundle', () => {
  const prescription = {
    id: PRESC_ID,
    consultation_id: CONSULT_ID,
    qr_code: 'ABC123',
    medications: [
      { name: 'Ibuprofen', dose: '400mg', frequency: 'every 8h', code: '5640' },
      { name: 'Omeprazole', dose: '20mg', frequency: 'daily' },
    ],
    instructions: 'Take with food',
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(),
  }

  it('returns Bundle resourceType', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.resourceType).toBe('Bundle')
    expect(result.type).toBe('collection')
  })

  it('creates one entry per medication', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.entry).toHaveLength(2)
    expect(result.entry[0].resource.resourceType).toBe('MedicationRequest')
  })

  it('includes RxNorm code when provided', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.entry[0].resource.medicationCodeableConcept.coding[0].code).toBe('5640')
  })

  it('omits code field when not provided', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.entry[1].resource.medicationCodeableConcept.coding[0].code).toBeUndefined()
  })

  it('sets status active for non-expired prescription', () => {
    const result = toFhirMedicationBundle(prescription as any, PATIENT_ID)
    expect(result.entry[0].resource.status).toBe('active')
  })

  it('sets status completed for expired prescription', () => {
    const expired = { ...prescription, valid_until: new Date(Date.now() - 1000) }
    const result  = toFhirMedicationBundle(expired as any, PATIENT_ID)
    expect(result.entry[0].resource.status).toBe('completed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

Expected: FAIL with `Cannot find module './fhir'`.

- [ ] **Step 3: Implement lib/fhir.ts**

Create `packages/api/src/lib/fhir.ts`:

```typescript
import { ConsultationStatus, Language, User, Doctor, Patient, Consultation, Prescription } from '@prisma/client'
import type { Medication } from '../services/ConsultationService'

type FhirEncounterStatus = 'planned' | 'in-progress' | 'finished' | 'cancelled'

const ENCOUNTER_STATUS: Record<ConsultationStatus, FhirEncounterStatus> = {
  pending:   'planned',
  active:    'in-progress',
  completed: 'finished',
  rejected:  'cancelled',
  cancelled: 'cancelled',
}

export function toFhirEncounter(c: Pick<Consultation,
  'id' | 'patient_id' | 'doctor_id' | 'status' | 'diagnosis' | 'diagnosis_code' | 'created_at' | 'completed_at'
>) {
  return {
    resourceType: 'Encounter' as const,
    id: c.id,
    status: ENCOUNTER_STATUS[c.status],
    class: {
      system:  'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code:    'VR',
      display: 'virtual',
    },
    subject: { reference: `Patient/${c.patient_id}` },
    ...(c.doctor_id && {
      participant: [{ individual: { reference: `Practitioner/${c.doctor_id}` } }],
    }),
    ...(c.diagnosis && {
      reasonCode: [{
        coding: [{
          system:  'http://hl7.org/fhir/sid/icd-10',
          ...(c.diagnosis_code && { code: c.diagnosis_code }),
          display: c.diagnosis,
        }],
        text: c.diagnosis,
      }],
    }),
    period: {
      start: c.created_at.toISOString(),
      ...(c.completed_at && { end: c.completed_at.toISOString() }),
    },
  }
}

export function toFhirPatient(
  user: Pick<User, 'phone' | 'name' | 'preferred_language'>,
  patient: Pick<Patient, 'id' | 'dob'>
) {
  return {
    resourceType: 'Patient' as const,
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
}

export function toFhirPractitioner(
  user: Pick<User, 'phone' | 'name'>,
  doctor: Pick<Doctor, 'id' | 'cedula'>
) {
  return {
    resourceType: 'Practitioner' as const,
    id: doctor.id,
    telecom: [{ system: 'phone', value: user.phone }],
    ...(user.name && { name: [{ text: user.name }] }),
    ...(doctor.cedula && {
      identifier: [{
        system: 'urn:oid:2.16.840.1.113883.2.341.1',
        value:  doctor.cedula,
      }],
    }),
  }
}

export function toFhirMedicationBundle(
  prescription: Pick<Prescription, 'id' | 'valid_until'> & { medications: unknown },
  patientId: string
) {
  const meds = prescription.medications as Medication[]
  return {
    resourceType: 'Bundle' as const,
    type: 'collection' as const,
    entry: meds.map((med, i) => ({
      resource: {
        resourceType: 'MedicationRequest' as const,
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|fhir)"
```

Expected: All FHIR mapper tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/lib/fhir.ts packages/api/src/lib/fhir.test.ts
git commit -m "feat: add FHIR R4 resource mappers with TDD"
```

---

## Task 6: requireRole middleware helper (TDD)

**Files:**
- Modify: `packages/api/src/middleware/requireAuth.ts`
- Modify: `packages/api/src/middleware/requireAuth.test.ts`

- [ ] **Step 1: Add failing tests to requireAuth.test.ts**

Append to the bottom of `packages/api/src/middleware/requireAuth.test.ts` (after the last `})` of the `requireAuth` describe block):

```typescript
import { requireRole } from './requireAuth'

describe('requireRole', () => {
  function makeAuthedReq(role: Role) {
    const req = {
      headers: {},
      user: { sub: 'user-1', role, preferred_language: Language.es },
    } as Request
    const res = {
      status: vi.fn().mockReturnThis(),
      json:   vi.fn().mockReturnThis(),
    } as unknown as Response
    const next = vi.fn() as NextFunction
    return { req, res, next }
  }

  it('calls next() when role matches', () => {
    const { req, res, next } = makeAuthedReq(Role.doctor)
    requireRole(Role.doctor)(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when role does not match', () => {
    const { req, res, next } = makeAuthedReq(Role.patient)
    requireRole(Role.doctor)(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('accepts multiple roles — allows any matching role', () => {
    const { req, res, next } = makeAuthedReq(Role.admin)
    requireRole(Role.doctor, Role.admin)(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  it('returns 403 when req.user is undefined', () => {
    const req  = { headers: {} } as Request
    const res  = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response
    const next = vi.fn() as NextFunction
    requireRole(Role.doctor)(req, res, next)
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(requireRole|FAIL)"
```

Expected: FAIL — `requireRole is not exported`.

- [ ] **Step 3: Add requireRole to requireAuth.ts**

Append to the bottom of `packages/api/src/middleware/requireAuth.ts`:

```typescript
import type { RequestHandler } from 'express'

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' })
      return
    }
    next()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(requireRole|PASS|FAIL)"
```

Expected: All requireRole tests pass. Total test count increased by 4.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/middleware/requireAuth.ts packages/api/src/middleware/requireAuth.test.ts
git commit -m "feat: add requireRole middleware helper"
```

---

## Task 7: Update app.ts + server.ts + auth.test.ts

**Files:**
- Modify: `packages/api/src/app.ts`
- Modify: `packages/api/src/server.ts`
- Modify: `packages/api/src/routes/auth.test.ts`

- [ ] **Step 1: Rewrite app.ts to accept new deps and return { app }**

Write `packages/api/src/app.ts`:

```typescript
import express from 'express'
import helmet from 'helmet'
import type { PrismaClient } from '@prisma/client'
import type { Server } from 'socket.io'
import { AuthService } from './services/AuthService'
import { ConsultationService } from './services/ConsultationService'
import { PrescriptionService } from './services/PrescriptionService'
import { UploadService } from './services/UploadService'
import { otpService } from './services/OtpService'
import { prisma as defaultPrisma } from './lib/prisma'
import { createAuthRouter } from './routes/auth'

interface AppDeps {
  authService?:         AuthService
  consultationService?: ConsultationService
  prescriptionService?: PrescriptionService
  uploadService?:       UploadService
  db?:                  PrismaClient
  io?:                  Server
}

export function createApp(deps?: AppDeps): { app: express.Express } {
  const app = express()

  app.use(helmet())
  app.use(express.json({ limit: '10kb' }))

  const db                 = deps?.db                 ?? defaultPrisma
  const authService        = deps?.authService        ?? new AuthService(otpService, db)
  const consultationService = deps?.consultationService ?? new ConsultationService(db, deps?.io)
  const prescriptionService = deps?.prescriptionService ?? new PrescriptionService(db)
  const uploadService      = deps?.uploadService      ?? new UploadService()

  app.use('/api/auth', createAuthRouter(authService))
  app.get('/health', (_req, res) => res.json({ ok: true }))

  return { app }
}
```

Note: doctors, consultations, prescriptions, admin, and fhir routes will be added in Tasks 8–10 as each is implemented.

- [ ] **Step 2: Update auth.test.ts makeTestApp to use new return type**

In `packages/api/src/routes/auth.test.ts`, change `makeTestApp`:

Old:
```typescript
function makeTestApp() {
  const otp = new DevOtpService()
  const authService = new AuthService(otp, mockPrisma as any)
  return { app: createApp({ authService }), otp }
}
```

New:
```typescript
function makeTestApp() {
  const otp = new DevOtpService()
  const authService = new AuthService(otp, mockPrisma as any)
  const { app } = createApp({ authService })
  return { app, otp }
}
```

- [ ] **Step 3: Rewrite server.ts**

Write `packages/api/src/server.ts`:

```typescript
import 'dotenv/config'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createApp } from './app'
import { prisma } from './lib/prisma'

const httpServer = createServer()
const io         = new Server(httpServer, { cors: { origin: '*' } })
const { app }    = createApp({ io })
httpServer.on('request', app)

const PORT = parseInt(process.env.PORT ?? '3000', 10)
httpServer.listen(PORT, () => console.log(`MédicoYa API on port ${PORT}`))
```

- [ ] **Step 4: Run all tests to verify nothing broke**

```bash
npm test
```

Expected: All existing tests still passing (24+ tests). `tsc --noEmit` should also pass.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/app.ts packages/api/src/server.ts packages/api/src/routes/auth.test.ts
git commit -m "refactor: createApp returns { app }, wire http.Server + Socket.io in server.ts"
```

---

## Task 8: Doctors + Admin routes (TDD)

**Files:**
- Create: `packages/api/src/routes/doctors.ts`
- Create: `packages/api/src/routes/admin.ts`
- Create: `packages/api/src/routes/doctors.test.ts`
- Create: `packages/api/src/routes/admin.test.ts`
- Modify: `packages/api/src/app.ts`

- [ ] **Step 1: Write failing tests for doctors route**

Create `packages/api/src/routes/doctors.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'

const SECRET  = 'test-secret-medicoya-min-32-chars-ok'
const DOC_ID  = 'doctor-uuid-1'
const PAT_ID  = 'patient-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockDoctor = {
  id: DOC_ID, cedula: '12345', cmh_verified: true,
  available: true, bio: null, approved_at: new Date(),
  user: { name: 'Dr. Juan', phone: '+50499000001' },
}

const mockDb = {
  doctor: {
    findMany: vi.fn(),
    update:   vi.fn(),
    findUnique: vi.fn(),
  },
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/doctors/available', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).get('/api/doctors/available')
    expect(res.status).toBe(401)
  })

  it('returns available approved doctors', async () => {
    mockDb.doctor.findMany.mockResolvedValue([mockDoctor])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/doctors/available')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].id).toBe(DOC_ID)
  })
})

describe('PUT /api/doctors/availability', () => {
  it('returns 403 when caller is not a doctor', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put('/api/doctors/availability')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .send({ available: false })
    expect(res.status).toBe(403)
  })

  it('updates available field for doctor', async () => {
    mockDb.doctor.update.mockResolvedValue({ ...mockDoctor, available: false })
    const app = makeTestApp()
    const res = await request(app)
      .put('/api/doctors/availability')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ available: false })
    expect(res.status).toBe(200)
    expect(mockDb.doctor.update).toHaveBeenCalledWith({
      where: { id: DOC_ID },
      data:  { available: false },
    })
  })
})
```

- [ ] **Step 2: Write failing tests for admin route**

Create `packages/api/src/routes/admin.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'

const SECRET   = 'test-secret-medicoya-min-32-chars-ok'
const ADMIN_ID = 'admin-uuid-1'
const DOC_ID   = 'doctor-uuid-1'
const PAT_ID   = 'patient-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockDb = {
  doctor: {
    findMany:  vi.fn(),
    update:    vi.fn(),
    findUnique: vi.fn(),
  },
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/admin/doctors/pending', () => {
  it('returns 403 for patient role', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns 403 for doctor role', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(403)
  })

  it('returns pending doctors for admin', async () => {
    mockDb.doctor.findMany.mockResolvedValue([{ id: DOC_ID, approved_at: null }])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/admin/doctors/pending')
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('PUT /api/admin/doctors/:id/approve', () => {
  it('returns 403 for non-admin', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/approve`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('sets approved_at for admin', async () => {
    mockDb.doctor.update.mockResolvedValue({ id: DOC_ID, approved_at: new Date() })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/admin/doctors/${DOC_ID}/approve`)
      .set('Authorization', `Bearer ${makeToken(ADMIN_ID, Role.admin)}`)
    expect(res.status).toBe(200)
    expect(mockDb.doctor.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: DOC_ID } })
    )
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(doctors|admin|FAIL)"
```

Expected: FAIL — routes not found (404 responses) or route files not existing.

- [ ] **Step 4: Implement doctors route**

Create `packages/api/src/routes/doctors.ts`:

```typescript
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireAuth'
import { Role } from '@prisma/client'

const availabilitySchema = z.object({ available: z.boolean() })

export function createDoctorsRouter(db: PrismaClient): Router {
  const router = Router()

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

- [ ] **Step 5: Implement admin route**

Create `packages/api/src/routes/admin.ts`:

```typescript
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { Role } from '@prisma/client'

export function createAdminRouter(db: PrismaClient): Router {
  const router = Router()

  router.get(
    '/doctors/pending',
    requireAuth,
    requireRole(Role.admin),
    async (_req: Request, res: Response): Promise<void> => {
      const doctors = await db.doctor.findMany({
        where:   { approved_at: null },
        include: { user: { select: { name: true, phone: true } } },
      })
      res.json(doctors)
    }
  )

  router.put(
    '/doctors/:id/approve',
    requireAuth,
    requireRole(Role.admin),
    async (req: Request, res: Response): Promise<void> => {
      const doctor = await db.doctor.update({
        where: { id: req.params.id },
        data:  { approved_at: new Date() },
      })
      res.json(doctor)
    }
  )

  return router
}
```

- [ ] **Step 6: Mount doctors and admin routes in app.ts**

In `packages/api/src/app.ts`, add the imports and mount the routes.

Add after the existing auth import:
```typescript
import { createDoctorsRouter } from './routes/doctors'
import { createAdminRouter } from './routes/admin'
```

Add inside `createApp` after `app.use('/api/auth', ...)`:
```typescript
app.use('/api/doctors', createDoctorsRouter(db))
app.use('/api/admin',   createAdminRouter(db))
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|doctors|admin)"
```

Expected: All doctors and admin tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/routes/doctors.ts packages/api/src/routes/doctors.test.ts packages/api/src/routes/admin.ts packages/api/src/routes/admin.test.ts packages/api/src/app.ts
git commit -m "feat: add doctors and admin routes with TDD"
```

---

## Task 9: Consultations routes (TDD)

**Files:**
- Create: `packages/api/src/routes/consultations.test.ts`
- Create: `packages/api/src/routes/consultations.ts`
- Modify: `packages/api/src/app.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/routes/consultations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language, ConsultationStatus, PaymentStatus } from '@prisma/client'
import { ConsultationError } from '../services/ConsultationService'

const SECRET    = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID    = 'patient-uuid-1'
const DOC_ID    = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const baseConsultation = {
  id: CONSULT_ID, patient_id: PAT_ID, doctor_id: null,
  status: ConsultationStatus.pending,
  symptoms_text: 'headache', symptom_photo: null,
  diagnosis: null, diagnosis_code: null,
  price_lps: null, payment_status: PaymentStatus.pending,
  created_at: new Date(), completed_at: null,
}

const mockConsultationService = {
  createConsultation:  vi.fn(),
  getConsultation:     vi.fn(),
  acceptConsultation:  vi.fn(),
  rejectConsultation:  vi.fn(),
  cancelConsultation:  vi.fn(),
  completeConsultation: vi.fn(),
  confirmPayment:      vi.fn(),
  getUserConsultations: vi.fn(),
}

const mockUploadService = {
  uploadPhoto: vi.fn().mockResolvedValue('https://res.cloudinary.com/test/image/upload/test.jpg'),
}

function makeTestApp() {
  const { app } = createApp({
    consultationService: mockConsultationService as any,
    uploadService:       mockUploadService as any,
  })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('POST /api/consultations', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).post('/api/consultations').send({})
    expect(res.status).toBe(401)
  })

  it('returns 403 when caller is a doctor', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ symptoms_text: 'headache' })
    expect(res.status).toBe(403)
  })

  it('creates consultation without photo', async () => {
    mockConsultationService.createConsultation.mockResolvedValue({ ...baseConsultation })
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .field('symptoms_text', 'headache')
    expect(res.status).toBe(201)
    expect(res.body.patient_id).toBe(PAT_ID)
    expect(mockUploadService.uploadPhoto).not.toHaveBeenCalled()
  })

  it('uploads photo and passes URL to service', async () => {
    mockConsultationService.createConsultation.mockResolvedValue({
      ...baseConsultation, symptom_photo: 'https://res.cloudinary.com/test/image/upload/test.jpg',
    })
    const app = makeTestApp()
    const res = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .field('symptoms_text', 'rash')
      .attach('photo', Buffer.from('fake-image-data'), { filename: 'photo.jpg', contentType: 'image/jpeg' })
    expect(res.status).toBe(201)
    expect(mockUploadService.uploadPhoto).toHaveBeenCalled()
    expect(mockConsultationService.createConsultation).toHaveBeenCalledWith(
      PAT_ID,
      expect.objectContaining({ symptom_photo: 'https://res.cloudinary.com/test/image/upload/test.jpg' })
    )
  })
})

describe('GET /api/consultations/my', () => {
  it('returns consultations for current user', async () => {
    mockConsultationService.getUserConsultations.mockResolvedValue([{ ...baseConsultation }])
    const app = makeTestApp()
    const res = await request(app)
      .get('/api/consultations/my')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(mockConsultationService.getUserConsultations).toHaveBeenCalledWith(PAT_ID, Role.patient)
  })
})

describe('GET /api/consultations/:id', () => {
  it('returns consultation for participant', async () => {
    mockConsultationService.getConsultation.mockResolvedValue({ ...baseConsultation })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/consultations/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(CONSULT_ID)
  })

  it('returns 403 for non-participant', async () => {
    mockConsultationService.getConsultation.mockRejectedValue(
      new ConsultationError('NOT_PARTICIPANT', 'Not a participant')
    )
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/consultations/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken('other-user', Role.patient)}`)
    expect(res.status).toBe(403)
  })
})

describe('PUT /api/consultations/:id/accept', () => {
  it('returns 403 when caller is not a doctor', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/accept`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('accepts consultation and returns updated', async () => {
    mockConsultationService.acceptConsultation.mockResolvedValue({
      ...baseConsultation, status: ConsultationStatus.active, doctor_id: DOC_ID,
    })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/accept`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('active')
  })

  it('returns 409 when consultation not pending', async () => {
    mockConsultationService.acceptConsultation.mockRejectedValue(
      new ConsultationError('WRONG_STATUS', 'Must be pending')
    )
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/accept`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(409)
  })
})

describe('PUT /api/consultations/:id/complete', () => {
  it('completes consultation and returns consultation + prescription', async () => {
    mockConsultationService.completeConsultation.mockResolvedValue({
      consultation: { ...baseConsultation, status: ConsultationStatus.completed },
      prescription: { id: 'presc-1', qr_code: 'ABC123', medications: [], valid_until: new Date(), created_at: new Date(), consultation_id: CONSULT_ID, instructions: null },
    })
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/complete`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ diagnosis: 'flu', medications: [{ name: 'Ibuprofeno', dose: '400mg', frequency: 'every 8h' }] })
    expect(res.status).toBe(200)
    expect(res.body.consultation.status).toBe('completed')
    expect(res.body.prescription.qr_code).toBeTruthy()
  })

  it('returns 400 when diagnosis is missing', async () => {
    const app = makeTestApp()
    const res = await request(app)
      .put(`/api/consultations/${CONSULT_ID}/complete`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ medications: [] })
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(consultations|FAIL)" | head -15
```

Expected: FAIL — routes not found.

- [ ] **Step 3: Implement consultations route**

Create `packages/api/src/routes/consultations.ts`:

```typescript
import { Router, Request, Response } from 'express'
import multer from 'multer'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { ConsultationService, ConsultationError } from '../services/ConsultationService'
import { UploadService } from '../services/UploadService'

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
  },
})

const completeSchema = z.object({
  diagnosis:      z.string().min(1),
  diagnosis_code: z.string().optional(),
  medications:    z.array(z.object({
    name:      z.string(),
    dose:      z.string(),
    frequency: z.string(),
    code:      z.string().optional(),
  })),
  instructions: z.string().optional(),
  price_lps:    z.number().optional(),
})

function handleConsultationError(err: unknown, res: Response): boolean {
  if (err instanceof ConsultationError) {
    const map: Record<string, number> = {
      NOT_FOUND: 404, NOT_PARTICIPANT: 403, WRONG_STATUS: 409, WRONG_ROLE: 403,
    }
    res.status(map[err.code] ?? 500).json({ error: err.message })
    return true
  }
  return false
}

export function createConsultationsRouter(
  consultationService: ConsultationService,
  uploadService: UploadService
): Router {
  const router = Router()

  router.post(
    '/',
    requireAuth,
    requireRole(Role.patient),
    upload.single('photo'),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const symptom_photo = req.file
          ? await uploadService.uploadPhoto(req.file.buffer, req.file.mimetype)
          : undefined

        const consultation = await consultationService.createConsultation(req.user!.sub, {
          symptoms_text: req.body.symptoms_text,
          symptom_photo,
        })
        res.status(201).json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  // /my MUST be registered before /:id to avoid Express matching "my" as an id param
  router.get(
    '/my',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      const consultations = await consultationService.getUserConsultations(
        req.user!.sub,
        req.user!.role
      )
      res.json(consultations)
    }
  )

  router.get(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.getConsultation(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/accept',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.acceptConsultation(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/reject',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.rejectConsultation(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/cancel',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.cancelConsultation(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/complete',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = completeSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'diagnosis and medications are required' })
        return
      }
      try {
        const result = await consultationService.completeConsultation(
          req.params.id,
          req.user!.sub,
          parsed.data
        )
        res.json(result)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  router.put(
    '/:id/payment',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const consultation = await consultationService.confirmPayment(req.params.id, req.user!.sub)
        res.json(consultation)
      } catch (err) {
        if (!handleConsultationError(err, res)) throw err
      }
    }
  )

  return router
}
```

- [ ] **Step 4: Mount consultations route in app.ts**

Add import:
```typescript
import { createConsultationsRouter } from './routes/consultations'
```

Add mount inside `createApp`:
```typescript
app.use('/api/consultations', createConsultationsRouter(consultationService, uploadService))
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|consultations)"
```

Expected: All consultations tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/consultations.ts packages/api/src/routes/consultations.test.ts packages/api/src/app.ts
git commit -m "feat: add consultations routes with TDD"
```

---

## Task 10: Prescriptions + FHIR routes (TDD)

**Files:**
- Create: `packages/api/src/routes/prescriptions.test.ts`
- Create: `packages/api/src/routes/prescriptions.ts`
- Create: `packages/api/src/routes/fhir.test.ts`
- Create: `packages/api/src/routes/fhir.ts`
- Modify: `packages/api/src/app.ts`

- [ ] **Step 1: Write failing tests for prescriptions route**

Create `packages/api/src/routes/prescriptions.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'
import { PrescriptionError } from '../services/PrescriptionService'

const SECRET    = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID    = 'patient-uuid-1'
const PRESC_ID  = 'presc-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockPrescription = {
  id: PRESC_ID,
  consultation_id: 'consult-uuid-1',
  qr_code: 'ABC123XYZ0',
  medications: [{ name: 'Paracetamol', dose: '500mg', frequency: 'every 6h' }],
  instructions: null,
  valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  created_at: new Date(),
}

const mockPrescriptionService = {
  getPrescription: vi.fn(),
  getQrPng:        vi.fn(),
}

function makeTestApp() {
  const { app } = createApp({ prescriptionService: mockPrescriptionService as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/prescriptions/:id', () => {
  it('returns prescription for participant', async () => {
    mockPrescriptionService.getPrescription.mockResolvedValue({ ...mockPrescription })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/prescriptions/${PRESC_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(PRESC_ID)
  })

  it('returns 403 for non-participant', async () => {
    mockPrescriptionService.getPrescription.mockRejectedValue(
      new PrescriptionError('NOT_PARTICIPANT', 'Not a participant')
    )
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/prescriptions/${PRESC_ID}`)
      .set('Authorization', `Bearer ${makeToken('other', Role.patient)}`)
    expect(res.status).toBe(403)
  })
})

describe('GET /api/prescriptions/:id/qr', () => {
  it('returns PNG buffer with correct content-type', async () => {
    mockPrescriptionService.getQrPng.mockResolvedValue(Buffer.from('fake-png'))
    const app = makeTestApp()
    const res = await request(app)
      .get(`/api/prescriptions/${PRESC_ID}/qr`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/image\/png/)
  })
})
```

- [ ] **Step 2: Write failing tests for FHIR route**

Create `packages/api/src/routes/fhir.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language, ConsultationStatus, PaymentStatus } from '@prisma/client'

const SECRET    = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID    = 'patient-uuid-1'
const DOC_ID    = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'
const PRESC_ID   = 'presc-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockConsultation = {
  id: CONSULT_ID, patient_id: PAT_ID, doctor_id: DOC_ID,
  status: ConsultationStatus.active,
  symptoms_text: 'headache', symptom_photo: null,
  diagnosis: null, diagnosis_code: null,
  price_lps: null, payment_status: PaymentStatus.pending,
  created_at: new Date(), completed_at: null,
}

const mockDb = {
  consultation: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  doctor: {
    findUnique: vi.fn(),
  },
  prescription: {
    findUnique: vi.fn(),
  },
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /fhir/R4/Encounter/:id', () => {
  it('returns 401 without auth', async () => {
    const app = makeTestApp()
    const res = await request(app).get(`/fhir/R4/Encounter/${CONSULT_ID}`)
    expect(res.status).toBe(401)
  })

  it('returns FHIR Encounter with correct Content-Type', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/fhir/R4/Encounter/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/fhir\+json/)
    expect(res.body.resourceType).toBe('Encounter')
    expect(res.body.status).toBe('in-progress')
  })

  it('returns 403 for non-participant', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/fhir/R4/Encounter/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken('other-user', Role.patient)}`)
    expect(res.status).toBe(403)
  })

  it('returns 404 when consultation does not exist', async () => {
    mockDb.consultation.findUnique.mockResolvedValue(null)
    const app = makeTestApp()
    const res = await request(app)
      .get(`/fhir/R4/Encounter/${CONSULT_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(404)
  })
})

describe('GET /fhir/R4/Practitioner/:id', () => {
  it('returns FHIR Practitioner', async () => {
    mockDb.doctor.findUnique.mockResolvedValue({
      id: DOC_ID, cedula: '12345', cmh_verified: true, available: true, bio: null, approved_at: new Date(),
      user: { phone: '+50499000001', name: 'Dr. Juan', preferred_language: Language.es },
    })
    const app = makeTestApp()
    const res = await request(app)
      .get(`/fhir/R4/Practitioner/${DOC_ID}`)
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
    expect(res.status).toBe(200)
    expect(res.body.resourceType).toBe('Practitioner')
    expect(res.headers['content-type']).toMatch(/application\/fhir\+json/)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(prescriptions|fhir|FAIL)" | head -10
```

Expected: FAIL — routes not found.

- [ ] **Step 4: Implement prescriptions route**

Create `packages/api/src/routes/prescriptions.ts`:

```typescript
import { Router, Request, Response } from 'express'
import { PrescriptionService, PrescriptionError } from '../services/PrescriptionService'
import { requireAuth } from '../middleware/requireAuth'

function handlePrescriptionError(err: unknown, res: Response): boolean {
  if (err instanceof PrescriptionError) {
    res.status(err.code === 'NOT_FOUND' ? 404 : 403).json({ error: err.message })
    return true
  }
  return false
}

export function createPrescriptionsRouter(prescriptionService: PrescriptionService): Router {
  const router = Router()

  router.get(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const prescription = await prescriptionService.getPrescription(req.params.id, req.user!.sub)
        res.json(prescription)
      } catch (err) {
        if (!handlePrescriptionError(err, res)) throw err
      }
    }
  )

  router.get(
    '/:id/qr',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const buffer = await prescriptionService.getQrPng(req.params.id, req.user!.sub)
        res.setHeader('Content-Type', 'image/png')
        res.send(buffer)
      } catch (err) {
        if (!handlePrescriptionError(err, res)) throw err
      }
    }
  )

  return router
}
```

- [ ] **Step 5: Implement FHIR route**

Create `packages/api/src/routes/fhir.ts`:

```typescript
import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '../middleware/requireAuth'
import { toFhirEncounter, toFhirPatient, toFhirPractitioner, toFhirMedicationBundle } from '../lib/fhir'

const FHIR_JSON = 'application/fhir+json'

export function createFhirRouter(db: PrismaClient): Router {
  const router = Router()

  router.get('/Encounter/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const c = await db.consultation.findUnique({ where: { id: req.params.id } })
    if (!c) { res.status(404).json({ error: 'Not found' }); return }
    if (c.patient_id !== req.user!.sub && c.doctor_id !== req.user!.sub) {
      res.status(403).json({ error: 'Not a participant' }); return
    }
    res.setHeader('Content-Type', FHIR_JSON).json(toFhirEncounter(c))
  })

  router.get('/Patient/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const targetId = req.params.id
    const callerId = req.user!.sub

    // Allow: self access OR doctor with shared consultation
    if (callerId !== targetId) {
      const shared = await db.consultation.findUnique({
        where: { id: targetId },
        select: { patient_id: true, doctor_id: true },
      })
      const isDoctorOfPatient =
        shared && shared.patient_id === targetId && shared.doctor_id === callerId
      if (!isDoctorOfPatient) {
        res.status(403).json({ error: 'Forbidden' }); return
      }
    }

    const user = await db.user.findUnique({
      where:   { id: targetId },
      include: { patient: true },
    })
    if (!user?.patient) { res.status(404).json({ error: 'Not found' }); return }
    res.setHeader('Content-Type', FHIR_JSON).json(toFhirPatient(user, user.patient))
  })

  router.get('/Practitioner/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const doctor = await db.doctor.findUnique({
      where:   { id: req.params.id },
      include: { user: true },
    })
    if (!doctor) { res.status(404).json({ error: 'Not found' }); return }
    res.setHeader('Content-Type', FHIR_JSON).json(toFhirPractitioner(doctor.user, doctor))
  })

  router.get('/MedicationRequest/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
    const p = await db.prescription.findUnique({
      where:   { id: req.params.id },
      include: { consultation: { select: { patient_id: true, doctor_id: true } } },
    })
    if (!p) { res.status(404).json({ error: 'Not found' }); return }
    const { patient_id, doctor_id } = (p as any).consultation
    if (patient_id !== req.user!.sub && doctor_id !== req.user!.sub) {
      res.status(403).json({ error: 'Not a participant' }); return
    }
    res.setHeader('Content-Type', FHIR_JSON).json(toFhirMedicationBundle(p, patient_id))
  })

  return router
}
```

- [ ] **Step 6: Mount prescriptions and FHIR routes in app.ts**

Add imports:
```typescript
import { createPrescriptionsRouter } from './routes/prescriptions'
import { createFhirRouter }         from './routes/fhir'
```

Add mounts inside `createApp`:
```typescript
app.use('/api/prescriptions', createPrescriptionsRouter(prescriptionService))
app.use('/fhir/R4',           createFhirRouter(db))
```

- [ ] **Step 7: Run all tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL)"
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/routes/prescriptions.ts packages/api/src/routes/prescriptions.test.ts packages/api/src/routes/fhir.ts packages/api/src/routes/fhir.test.ts packages/api/src/app.ts
git commit -m "feat: add prescriptions and FHIR R4 read routes with TDD"
```

---

## Task 11: Socket.io handlers (TDD)

**Files:**
- Create: `packages/api/src/sockets/consultation.test.ts`
- Create: `packages/api/src/sockets/consultation.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/sockets/consultation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { io as ioc, Socket as ClientSocket } from 'socket.io-client'
import { AddressInfo } from 'net'
import jwt from 'jsonwebtoken'
import { registerConsultationHandlers } from './consultation'
import { Role, Language, MessageType, ConsultationStatus, PaymentStatus } from '@prisma/client'

const SECRET   = 'test-secret-medicoya-min-32-chars-ok'
const PAT_ID   = 'patient-uuid-1'
const DOC_ID   = 'doctor-uuid-1'
const CONSULT_ID = 'consult-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockConsultation = {
  id: CONSULT_ID, patient_id: PAT_ID, doctor_id: DOC_ID,
  status: ConsultationStatus.active,
}

const mockMessage = {
  id: 'msg-1', consultation_id: CONSULT_ID, sender_id: PAT_ID,
  content: 'Hello doc', msg_type: MessageType.text, created_at: new Date(),
}

const mockDb = {
  consultation: { findUnique: vi.fn() },
  message:      { create:     vi.fn() },
}

let ioServer: Server
let port: number
const clients: ClientSocket[] = []

beforeAll(async () => {
  const httpServer = createServer()
  ioServer = new Server(httpServer)
  registerConsultationHandlers(ioServer, mockDb as any)
  await new Promise<void>(resolve => httpServer.listen(0, resolve))
  port = (httpServer.address() as AddressInfo).port
})

afterAll(() => {
  clients.forEach(c => c.disconnect())
  ioServer.close()
})

afterEach(() => {
  vi.clearAllMocks()
  clients.forEach(c => c.disconnect())
  clients.length = 0
})

function connect(token?: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const opts = token ? { auth: { token } } : {}
    const client = ioc(`http://localhost:${port}`, { ...opts, reconnection: false })
    clients.push(client)
    client.on('connect', () => resolve(client))
    client.on('connect_error', reject)
  })
}

describe('Socket.io authentication', () => {
  it('rejects connection without token', async () => {
    await expect(connect()).rejects.toThrow('UNAUTHORIZED')
  })

  it('rejects connection with invalid token', async () => {
    await expect(connect('bad-token')).rejects.toThrow('UNAUTHORIZED')
  })

  it('accepts connection with valid JWT', async () => {
    const client = await connect(makeToken(PAT_ID, Role.patient))
    expect(client.connected).toBe(true)
  })
})

describe('join_consultation', () => {
  it('allows patient to join their consultation', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    const client = await connect(makeToken(PAT_ID, Role.patient))

    await new Promise<void>((resolve, reject) => {
      client.emit('join_consultation', { consultation_id: CONSULT_ID })
      client.on('error', reject)
      // If no error within 100ms, consider it accepted
      setTimeout(resolve, 100)
    })
  })

  it('emits error when user is not participant', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    const client = await connect(makeToken('other-user', Role.patient))

    const errorCode = await new Promise<string>((resolve) => {
      client.on('error', (err: { code: string }) => resolve(err.code))
      client.emit('join_consultation', { consultation_id: CONSULT_ID })
    })
    expect(errorCode).toBe('NOT_PARTICIPANT')
  })

  it('emits error when consultation does not exist', async () => {
    mockDb.consultation.findUnique.mockResolvedValue(null)
    const client = await connect(makeToken(PAT_ID, Role.patient))

    const errorCode = await new Promise<string>((resolve) => {
      client.on('error', (err: { code: string }) => resolve(err.code))
      client.emit('join_consultation', { consultation_id: 'nonexistent' })
    })
    expect(errorCode).toBe('NOT_FOUND')
  })
})

describe('send_message', () => {
  it('persists message and broadcasts to room', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...mockConsultation })
    mockDb.message.create.mockResolvedValue({ ...mockMessage })

    const patToken = makeToken(PAT_ID, Role.patient)
    const docToken = makeToken(DOC_ID, Role.doctor)

    const [patClient, docClient] = await Promise.all([connect(patToken), connect(docToken)])

    // Both join the consultation room
    await Promise.all([
      new Promise<void>(resolve => { patClient.emit('join_consultation', { consultation_id: CONSULT_ID }); setTimeout(resolve, 50) }),
      new Promise<void>(resolve => { docClient.emit('join_consultation', { consultation_id: CONSULT_ID }); setTimeout(resolve, 50) }),
    ])

    const received = await new Promise<Record<string, unknown>>((resolve) => {
      docClient.on('receive_message', resolve)
      patClient.emit('send_message', { consultation_id: CONSULT_ID, content: 'Hello doc', msg_type: 'text' })
    })

    expect(received.content).toBe('Hello doc')
    expect(received.sender_id).toBe(PAT_ID)
    expect(mockDb.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          consultation_id: CONSULT_ID,
          sender_id: PAT_ID,
          content: 'Hello doc',
        }),
      })
    )
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(Socket|FAIL|consultation.test)" | head -15
```

Expected: FAIL — `Cannot find module './consultation'`.

- [ ] **Step 3: Implement Socket.io handlers**

Create `packages/api/src/sockets/consultation.ts`:

```typescript
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import type { Server, Socket } from 'socket.io'
import type { JwtPayload } from '../middleware/requireAuth'

export function registerConsultationHandlers(io: Server, db: PrismaClient): void {
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

  io.on('connection', (socket: Socket) => {
    socket.on('join_consultation', async ({ consultation_id }: { consultation_id: string }) => {
      try {
        const c = await db.consultation.findUnique({ where: { id: consultation_id } })
        if (!c) {
          socket.emit('error', { code: 'NOT_FOUND', message: 'Consultation not found' })
          return
        }
        const userId = socket.data.user.sub
        if (c.patient_id !== userId && c.doctor_id !== userId) {
          socket.emit('error', { code: 'NOT_PARTICIPANT', message: 'Not a participant' })
          return
        }
        socket.join(consultation_id)
      } catch (err) {
        socket.emit('error', { code: 'SERVER_ERROR', message: 'Unexpected error' })
      }
    })

    socket.on(
      'send_message',
      async ({
        consultation_id,
        content,
        msg_type,
      }: {
        consultation_id: string
        content: string
        msg_type: 'text' | 'image'
      }) => {
        try {
          const c = await db.consultation.findUnique({ where: { id: consultation_id } })
          if (!c) { socket.emit('error', { code: 'NOT_FOUND', message: 'Consultation not found' }); return }
          const userId = socket.data.user.sub
          if (c.patient_id !== userId && c.doctor_id !== userId) {
            socket.emit('error', { code: 'NOT_PARTICIPANT', message: 'Not a participant' }); return
          }
          const message = await db.message.create({
            data: {
              consultation_id,
              sender_id: userId,
              content,
              msg_type: msg_type ?? 'text',
            },
          })
          io.to(consultation_id).emit('receive_message', {
            id:          message.id,
            sender_id:   message.sender_id,
            content:     message.content,
            msg_type:    message.msg_type,
            created_at:  message.created_at,
          })
        } catch (err) {
          socket.emit('error', { code: 'SERVER_ERROR', message: 'Unexpected error' })
        }
      }
    )
  })
}
```

- [ ] **Step 4: Run Socket.io tests**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|Socket|consultation.test)"
```

Expected: All Socket.io tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests passing. Run `npx tsc --noEmit` from `packages/api/` — no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/sockets/consultation.ts packages/api/src/sockets/consultation.test.ts
git commit -m "feat: add Socket.io consultation handlers with TDD"
```

---

## Final verification

- [ ] **Step 1: Run full test suite one last time**

```bash
npm test
```

Expected: All tests passing, 0 failures.

- [ ] **Step 2: TypeScript compile check**

```bash
npx tsc --noEmit --project packages/api/tsconfig.json
```

Expected: No errors.

- [ ] **Step 3: Verify all spec DoD criteria are met**

Check each criterion from the spec `## Criterios de aceptación` section against the passing tests.

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -p  # stage only intentional changes
git commit -m "fix: final cleanup sub-proyecto 2"
```
