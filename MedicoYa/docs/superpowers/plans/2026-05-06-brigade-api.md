# Brigade API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Brigade API backend — schema, middleware, service, routes, and tests for brigade creation, membership, dashboard, reporting, and offline consultation sync.

**Architecture:** New `Brigade` and `BrigadeDoctor` Prisma models extend the existing schema; a `BrigadeService` encapsulates all business logic; two dedicated routers (`/api/brigades` and `/api/sync`) expose the endpoints; `requireBrigadeOwner` / `requireBrigadeMember` middleware enforce access control. Tests use the existing supertest + mock-db pattern (same as `admin.test.ts`).

**Tech Stack:** Express, Prisma 5, PostgreSQL, Zod, Vitest, Supertest, TypeScript, Node.js `crypto` (join code + UUID generation — no extra dependencies)

---

## File Map

| Action | File |
|--------|------|
| MOD | `packages/api/prisma/schema.prisma` |
| NEW | `packages/api/prisma/migrations/20260506000002_add_brigades/migration.sql` |
| NEW | `packages/api/src/middleware/requireBrigade.ts` |
| NEW | `packages/api/src/services/BrigadeService.ts` |
| NEW | `packages/api/src/routes/brigades.ts` |
| NEW | `packages/api/src/routes/brigades.test.ts` |
| NEW | `packages/api/src/routes/sync.ts` |
| NEW | `packages/api/src/routes/sync.test.ts` |
| MOD | `packages/api/src/app.ts` |

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `packages/api/prisma/schema.prisma`
- Create: `packages/api/prisma/migrations/20260506000002_add_brigades/migration.sql`

- [ ] **Step 1: Update `schema.prisma`**

Replace the `Role` enum and add new enums + models. Apply these changes to `packages/api/prisma/schema.prisma`:

**Replace the existing `Role` enum:**
```prisma
enum Role {
  patient
  doctor
  admin
  coordinator
}
```

**Add after the `Role` enum:**
```prisma
enum ConsultationMode {
  telemedicine
  brigade
}

enum BrigadeStatus {
  active
  closed
}
```

**Add after the `Rating` model (end of file):**
```prisma
model Brigade {
  id           String        @id @default(uuid())
  name         String
  organizer_id String
  community    String
  municipality String?
  department   String?
  start_date   DateTime
  end_date     DateTime
  join_code    String        @unique
  status       BrigadeStatus @default(active)
  created_at   DateTime      @default(now())

  organizer     User            @relation(fields: [organizer_id], references: [id])
  doctors       BrigadeDoctor[]
  consultations Consultation[]
}

model BrigadeDoctor {
  brigade_id String
  doctor_id  String
  joined_at  DateTime @default(now())

  brigade Brigade @relation(fields: [brigade_id], references: [id], onDelete: Cascade)
  doctor  Doctor  @relation(fields: [doctor_id], references: [id], onDelete: Cascade)

  @@id([brigade_id, doctor_id])
}
```

**Add back-relation to `User` model** (inside the model, after `pushTokens PushToken[]`):
```prisma
  brigades Brigade[]
```

**Add back-relation to `Doctor` model** (inside the model, after `ratings Rating[]`):
```prisma
  brigadeMemberships BrigadeDoctor[]
```

**Add four fields to `Consultation` model** (after `completed_at DateTime?`):
```prisma
  mode       ConsultationMode @default(telemedicine)
  brigade_id String?
  local_id   String?
  synced_at  DateTime?
```

**Add relation to `Consultation` model** (after `rating Rating?`):
```prisma
  brigade Brigade? @relation(fields: [brigade_id], references: [id])
```

The complete final `schema.prisma` should look like this (full file):

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

  doctor     Doctor?
  patient    Patient?
  messages   Message[]
  pushTokens PushToken[]
  brigades   Brigade[]
}

enum Role {
  patient
  doctor
  admin
  coordinator
}

enum Language {
  es
  en
}

enum ConsultationMode {
  telemedicine
  brigade
}

enum BrigadeStatus {
  active
  closed
}

model PushToken {
  id         String   @id @default(uuid())
  user_id    String
  token      String   @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)
}

model Doctor {
  id           String    @id
  user         User      @relation(fields: [id], references: [id])
  cedula       String?   @unique
  cmh_verified Boolean   @default(false)
  available    Boolean   @default(false)
  bio          String?
  approved_at  DateTime?
  rejected_at  DateTime?

  consultations      Consultation[]
  ratings            Rating[]
  brigadeMemberships BrigadeDoctor[]
}

model Patient {
  id                String           @id
  user              User             @relation(fields: [id], references: [id])
  dob               DateTime?
  allergies         String?
  registered_by     String?
  registration_mode RegistrationMode @default(self)

  consultations Consultation[]
  ratings      Rating[]
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
  mode           ConsultationMode   @default(telemedicine)
  brigade_id     String?
  local_id       String?
  synced_at      DateTime?

  patient      Patient       @relation(fields: [patient_id], references: [id])
  doctor       Doctor?       @relation(fields: [doctor_id], references: [id])
  messages     Message[]
  prescription Prescription?
  rating       Rating?
  brigade      Brigade?      @relation(fields: [brigade_id], references: [id])
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

model Rating {
  id              String   @id @default(uuid())
  consultation_id String   @unique
  doctor_id       String
  patient_id      String
  stars           Int
  comment         String?
  created_at      DateTime @default(now())

  consultation Consultation @relation(fields: [consultation_id], references: [id], onDelete: Cascade)
  doctor       Doctor       @relation(fields: [doctor_id], references: [id], onDelete: Cascade)
  patient      Patient      @relation(fields: [patient_id], references: [id], onDelete: Cascade)
}

model Brigade {
  id           String        @id @default(uuid())
  name         String
  organizer_id String
  community    String
  municipality String?
  department   String?
  start_date   DateTime
  end_date     DateTime
  join_code    String        @unique
  status       BrigadeStatus @default(active)
  created_at   DateTime      @default(now())

  organizer     User            @relation(fields: [organizer_id], references: [id])
  doctors       BrigadeDoctor[]
  consultations Consultation[]
}

model BrigadeDoctor {
  brigade_id String
  doctor_id  String
  joined_at  DateTime @default(now())

  brigade Brigade @relation(fields: [brigade_id], references: [id], onDelete: Cascade)
  doctor  Doctor  @relation(fields: [doctor_id], references: [id], onDelete: Cascade)

  @@id([brigade_id, doctor_id])
}
```

- [ ] **Step 2: Create migration file**

Create directory `packages/api/prisma/migrations/20260506000002_add_brigades/` and write `migration.sql`:

```sql
-- Add coordinator to Role enum
ALTER TYPE "Role" ADD VALUE 'coordinator';

-- New enums
CREATE TYPE "ConsultationMode" AS ENUM ('telemedicine', 'brigade');
CREATE TYPE "BrigadeStatus"    AS ENUM ('active', 'closed');

-- Brigade table
CREATE TABLE "Brigade" (
  "id"           TEXT            NOT NULL,
  "name"         TEXT            NOT NULL,
  "organizer_id" TEXT            NOT NULL,
  "community"    TEXT            NOT NULL,
  "municipality" TEXT,
  "department"   TEXT,
  "start_date"   TIMESTAMP(3)    NOT NULL,
  "end_date"     TIMESTAMP(3)    NOT NULL,
  "join_code"    TEXT            NOT NULL,
  "status"       "BrigadeStatus" NOT NULL DEFAULT 'active',
  "created_at"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Brigade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brigade_join_code_key" ON "Brigade"("join_code");
CREATE INDEX "Brigade_organizer_id_idx" ON "Brigade"("organizer_id");

ALTER TABLE "Brigade"
  ADD CONSTRAINT "Brigade_organizer_id_fkey"
  FOREIGN KEY ("organizer_id") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- BrigadeDoctor join table
CREATE TABLE "BrigadeDoctor" (
  "brigade_id" TEXT         NOT NULL,
  "doctor_id"  TEXT         NOT NULL,
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BrigadeDoctor_pkey" PRIMARY KEY ("brigade_id", "doctor_id")
);

CREATE INDEX "BrigadeDoctor_doctor_id_idx" ON "BrigadeDoctor"("doctor_id");

ALTER TABLE "BrigadeDoctor"
  ADD CONSTRAINT "BrigadeDoctor_brigade_id_fkey"
  FOREIGN KEY ("brigade_id") REFERENCES "Brigade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrigadeDoctor"
  ADD CONSTRAINT "BrigadeDoctor_doctor_id_fkey"
  FOREIGN KEY ("doctor_id") REFERENCES "Doctor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend Consultation
ALTER TABLE "Consultation"
  ADD COLUMN "mode"       "ConsultationMode" NOT NULL DEFAULT 'telemedicine',
  ADD COLUMN "brigade_id" TEXT,
  ADD COLUMN "local_id"   TEXT,
  ADD COLUMN "synced_at"  TIMESTAMP(3);

CREATE INDEX "Consultation_brigade_id_idx" ON "Consultation"("brigade_id");

ALTER TABLE "Consultation"
  ADD CONSTRAINT "Consultation_brigade_id_fkey"
  FOREIGN KEY ("brigade_id") REFERENCES "Brigade"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Back-relation index on User
CREATE INDEX "Brigade_organizer_id_key" ON "Brigade"("organizer_id");
```

- [ ] **Step 3: Regenerate Prisma client**

Run from `packages/api/`:
```bash
npx prisma generate
```

Expected: prints "Generated Prisma Client" with no errors. The `Role` enum in `@prisma/client` now includes `coordinator`.

- [ ] **Step 4: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations/20260506000002_add_brigades/
git commit -m "feat(api): add Brigade + BrigadeDoctor schema and migration"
```

---

## Task 2: requireBrigade middleware

**Files:**
- Create: `packages/api/src/middleware/requireBrigade.ts`

- [ ] **Step 1: Create the middleware file**

Create `packages/api/src/middleware/requireBrigade.ts`:

```typescript
import { RequestHandler } from 'express'
import { PrismaClient } from '@prisma/client'

export function requireBrigadeMember(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    try {
      const row = await db.brigadeDoctor.findUnique({
        where: {
          brigade_id_doctor_id: {
            brigade_id: req.params.id,
            doctor_id:  req.user!.sub,
          },
        },
      })
      if (!row) { res.status(403).json({ error: 'Forbidden' }); return }
      next()
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export function requireBrigadeOwner(db: PrismaClient): RequestHandler {
  return async (req, res, next) => {
    try {
      const brigade = await db.brigade.findUnique({ where: { id: req.params.id } })
      if (!brigade || brigade.organizer_id !== req.user!.sub) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      next()
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/middleware/requireBrigade.ts
git commit -m "feat(api): add requireBrigadeMember and requireBrigadeOwner middleware"
```

---

## Task 3: BrigadeService

**Files:**
- Create: `packages/api/src/services/BrigadeService.ts`

- [ ] **Step 1: Create the service**

Create `packages/api/src/services/BrigadeService.ts`:

```typescript
import crypto from 'crypto'
import {
  PrismaClient, Brigade,
  ConsultationMode, ConsultationStatus, RegistrationMode, Role,
} from '@prisma/client'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

function generateJoinCode(): string {
  const bytes = crypto.randomBytes(6)
  return Array.from(bytes).map(b => CHARS[b % 36]).join('')
}

export interface CreateBrigadeInput {
  name: string
  community: string
  municipality?: string
  department?: string
  start_date: string
  end_date: string
}

export interface SyncItem {
  local_id:      string
  patient_phone: string
  patient_name:  string
  symptoms_text?: string
  diagnosis?:    string
  medications?:  { name: string; dose: string; frequency: string }[]
  created_at:    string
}

export interface SyncResult {
  accepted: string[]
  rejected: { local_id: string; reason: string }[]
}

export interface BrigadeDashboard {
  total:          number
  attended:       number
  waiting:        number
  active_doctors: number
}

export class BrigadeService {
  constructor(private db: PrismaClient) {}

  async createBrigade(organizerId: string, data: CreateBrigadeInput): Promise<Brigade> {
    const build = (code: string) => ({
      id:           crypto.randomUUID(),
      name:         data.name,
      organizer_id: organizerId,
      community:    data.community,
      municipality: data.municipality,
      department:   data.department,
      start_date:   new Date(data.start_date),
      end_date:     new Date(data.end_date),
      join_code:    code,
    })
    try {
      return await this.db.brigade.create({ data: build(generateJoinCode()) })
    } catch (err: any) {
      if (err?.code === 'P2002' && (err?.meta?.target as string[])?.includes('join_code')) {
        return await this.db.brigade.create({ data: build(generateJoinCode()) })
      }
      throw err
    }
  }

  async joinBrigade(doctorId: string, brigadeId: string, joinCode: string): Promise<void> {
    const brigade = await this.db.brigade.findUnique({ where: { id: brigadeId } })
    if (!brigade || brigade.join_code.toUpperCase() !== joinCode.toUpperCase()) {
      const err = new Error('Invalid join code') as any
      err.code = 'INVALID_CODE'
      throw err
    }
    const existing = await this.db.brigadeDoctor.findUnique({
      where: { brigade_id_doctor_id: { brigade_id: brigadeId, doctor_id: doctorId } },
    })
    if (existing) {
      const err = new Error('Already joined') as any
      err.code = 'ALREADY_JOINED'
      throw err
    }
    await this.db.brigadeDoctor.create({ data: { brigade_id: brigadeId, doctor_id: doctorId } })
  }

  async getDashboard(brigadeId: string): Promise<BrigadeDashboard> {
    const today    = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)

    const [total, attended, waiting, activeDoctorRows] = await Promise.all([
      this.db.consultation.count({ where: { brigade_id: brigadeId } }),
      this.db.consultation.count({ where: { brigade_id: brigadeId, status: ConsultationStatus.completed } }),
      this.db.consultation.count({ where: { brigade_id: brigadeId, status: ConsultationStatus.pending } }),
      this.db.consultation.findMany({
        where:    { brigade_id: brigadeId, created_at: { gte: today, lt: tomorrow }, doctor_id: { not: null } },
        select:   { doctor_id: true },
        distinct: ['doctor_id'],
      }),
    ])
    return { total, attended, waiting, active_doctors: activeDoctorRows.length }
  }

  async getReport(brigadeId: string) {
    const [topDiagnoses, patientCount, selfCount, brigadeCount] = await Promise.all([
      this.db.consultation.groupBy({
        by:      ['diagnosis'],
        where:   { brigade_id: brigadeId, diagnosis: { not: null } },
        _count:  { diagnosis: true },
        orderBy: { _count: { diagnosis: 'desc' } },
        take:    10,
      }),
      this.db.patient.count({ where: { consultations: { some: { brigade_id: brigadeId } } } }),
      this.db.patient.count({
        where: { registration_mode: RegistrationMode.self, consultations: { some: { brigade_id: brigadeId } } },
      }),
      this.db.patient.count({
        where: { registration_mode: RegistrationMode.brigade_doctor, consultations: { some: { brigade_id: brigadeId } } },
      }),
    ])
    return {
      patient_count:        patientCount,
      by_registration_mode: { self: selfCount, brigade_doctor: brigadeCount },
      top_diagnoses:        topDiagnoses.map(d => ({ diagnosis: d.diagnosis!, count: d._count.diagnosis })),
    }
  }

  async syncConsultations(doctorId: string, brigadeId: string, items: SyncItem[]): Promise<SyncResult> {
    const accepted: string[] = []
    const rejected: { local_id: string; reason: string }[] = []

    for (const item of items) {
      try {
        const user = await this.db.user.upsert({
          where:  { phone: item.patient_phone },
          create: { id: crypto.randomUUID(), phone: item.patient_phone, name: item.patient_name, role: Role.patient },
          update: {},
        })
        await this.db.patient.upsert({
          where:  { id: user.id },
          create: { id: user.id, registered_by: doctorId, registration_mode: RegistrationMode.brigade_doctor },
          update: {},
        })

        await this.db.$transaction(async (tx) => {
          const consultation = await tx.consultation.create({
            data: {
              id:            crypto.randomUUID(),
              patient_id:    user.id,
              doctor_id:     doctorId,
              mode:          ConsultationMode.brigade,
              brigade_id:    brigadeId,
              local_id:      item.local_id,
              status:        ConsultationStatus.completed,
              symptoms_text: item.symptoms_text,
              diagnosis:     item.diagnosis,
              synced_at:     new Date(),
              created_at:    new Date(item.created_at),
            },
          })
          if (item.medications && item.medications.length > 0) {
            await tx.prescription.create({
              data: {
                id:              crypto.randomUUID(),
                consultation_id: consultation.id,
                qr_code:         crypto.randomUUID(),
                medications:     item.medications,
                valid_until:     new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              },
            })
          }
        })
        accepted.push(item.local_id)
      } catch (err: any) {
        rejected.push({ local_id: item.local_id, reason: err?.message ?? 'Unknown error' })
      }
    }
    return { accepted, rejected }
  }

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
      doctors: brigade.doctors.map(bd => ({ id: bd.doctor_id, name: bd.doctor.user.name })),
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/services/BrigadeService.ts
git commit -m "feat(api): add BrigadeService with create, join, dashboard, report, sync, seed"
```

---

## Task 4: brigades.ts route + tests

**Files:**
- Create: `packages/api/src/routes/brigades.ts`
- Create: `packages/api/src/routes/brigades.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/api/src/routes/brigades.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'

const SECRET     = 'test-secret-medicoya-min-32-chars-ok'
const COORD_ID   = 'coord-uuid-1'
const DOC_ID     = 'doctor-uuid-1'
const PAT_ID     = 'patient-uuid-1'
const BRIGADE_ID = 'brigade-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const mockBrigade = {
  id:           BRIGADE_ID,
  name:         'Brigada Norte',
  organizer_id: COORD_ID,
  community:    'Comunidad X',
  municipality: null,
  department:   null,
  start_date:   new Date('2026-05-10'),
  end_date:     new Date('2026-05-12'),
  join_code:    'ABC123',
  status:       'active',
  created_at:   new Date(),
  doctors:      [],
}

const mockDb = {
  brigade: {
    create:     vi.fn(),
    findUnique: vi.fn(),
  },
  brigadeDoctor: {
    findUnique: vi.fn(),
    create:     vi.fn(),
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

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

// --- POST / ---

describe('POST /api/brigades', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp())
      .post('/api/brigades')
      .send({ name: 'X', community: 'Y', start_date: '2026-05-10T00:00:00Z', end_date: '2026-05-12T00:00:00Z' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for patient role', async () => {
    const res = await request(makeTestApp())
      .post('/api/brigades')
      .set('Authorization', `Bearer ${makeToken(PAT_ID, Role.patient)}`)
      .send({ name: 'X', community: 'Y', start_date: '2026-05-10T00:00:00Z', end_date: '2026-05-12T00:00:00Z' })
    expect(res.status).toBe(403)
  })

  it('coordinator creates brigade — returns 201 with join_code', async () => {
    mockDb.brigade.create.mockResolvedValue({ ...mockBrigade, join_code: 'XYZ999' })
    const res = await request(makeTestApp())
      .post('/api/brigades')
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
      .send({ name: 'Brigada Norte', community: 'Comunidad X', start_date: '2026-05-10T00:00:00Z', end_date: '2026-05-12T00:00:00Z' })
    expect(res.status).toBe(201)
    expect(res.body.join_code).toBe('XYZ999')
  })
})

// --- GET /:id ---

describe('GET /api/brigades/:id', () => {
  it('returns 403 when caller is not member or owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, organizer_id: 'other', doctors: [] })
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with doctor list when coordinator owns brigade', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({
      ...mockBrigade,
      doctors: [{ doctor_id: DOC_ID, joined_at: new Date(), doctor: { user: { name: 'Dr. Juan' } } }],
    })
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(200)
    expect(res.body.doctors).toHaveLength(1)
    expect(res.body.doctors[0].doctor_id).toBe(DOC_ID)
    expect(res.body.doctors[0].name).toBe('Dr. Juan')
  })
})

// --- POST /:id/join ---

describe('POST /api/brigades/:id/join', () => {
  it('returns 400 for wrong join_code', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, join_code: 'ABC123' })
    const res = await request(makeTestApp())
      .post(`/api/brigades/${BRIGADE_ID}/join`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ join_code: 'WRONG1' })
    expect(res.status).toBe(400)
  })

  it('returns 409 when already joined', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, join_code: 'ABC123' })
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    const res = await request(makeTestApp())
      .post(`/api/brigades/${BRIGADE_ID}/join`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ join_code: 'ABC123' })
    expect(res.status).toBe(409)
  })

  it('returns 201 when doctor joins with correct code', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, join_code: 'ABC123' })
    mockDb.brigadeDoctor.findUnique.mockResolvedValue(null)
    mockDb.brigadeDoctor.create.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID, joined_at: new Date() })
    const res = await request(makeTestApp())
      .post(`/api/brigades/${BRIGADE_ID}/join`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ join_code: 'ABC123' })
    expect(res.status).toBe(201)
  })
})

// --- GET /:id/dashboard ---

describe('GET /api/brigades/:id/dashboard', () => {
  it('returns 403 for non-owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, organizer_id: 'other-coord' })
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}/dashboard`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with stats for brigade owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue(mockBrigade)
    mockDb.consultation.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(3)
    mockDb.consultation.findMany.mockResolvedValue([{ doctor_id: DOC_ID }])
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}/dashboard`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ total: 10, attended: 7, waiting: 3, active_doctors: 1 })
  })
})

// --- GET /:id/report ---

describe('GET /api/brigades/:id/report', () => {
  it('returns 403 for non-owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue({ ...mockBrigade, organizer_id: 'other-coord' })
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}/report`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with top_diagnoses for brigade owner', async () => {
    mockDb.brigade.findUnique.mockResolvedValue(mockBrigade)
    mockDb.consultation.groupBy.mockResolvedValue([
      { diagnosis: 'Hypertension', _count: { diagnosis: 5 } },
    ])
    mockDb.patient.count
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
    const res = await request(makeTestApp())
      .get(`/api/brigades/${BRIGADE_ID}/report`)
      .set('Authorization', `Bearer ${makeToken(COORD_ID, Role.coordinator)}`)
    expect(res.status).toBe(200)
    expect(res.body.patient_count).toBe(8)
    expect(res.body.by_registration_mode).toEqual({ self: 3, brigade_doctor: 5 })
    expect(res.body.top_diagnoses).toHaveLength(1)
    expect(res.body.top_diagnoses[0]).toEqual({ diagnosis: 'Hypertension', count: 5 })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd packages/api && npx vitest run src/routes/brigades.test.ts
```

Expected: tests fail because `brigades.ts` route does not exist yet.

- [ ] **Step 3: Create the route**

Create `packages/api/src/routes/brigades.ts`:

```typescript
import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { requireBrigadeOwner } from '../middleware/requireBrigade'
import { BrigadeService } from '../services/BrigadeService'

const createBrigadeSchema = z.object({
  name:         z.string().min(1).max(100),
  community:    z.string().min(1).max(100),
  municipality: z.string().max(100).optional(),
  department:   z.string().max(100).optional(),
  start_date:   z.string().datetime(),
  end_date:     z.string().datetime(),
})

export function createBrigadesRouter(db: PrismaClient): Router {
  const router  = Router()
  const service = new BrigadeService(db)

  router.post(
    '/',
    requireAuth,
    requireRole(Role.coordinator),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = createBrigadeSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request body' }); return }
      try {
        const brigade = await service.createBrigade(req.user!.sub, parsed.data)
        res.status(201).json(brigade)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/:id',
    requireAuth,
    async (req: Request, res: Response): Promise<void> => {
      try {
        const brigade = await db.brigade.findUnique({
          where:   { id: req.params.id },
          include: {
            doctors: {
              include: { doctor: { include: { user: { select: { name: true } } } } },
            },
          },
        })
        if (!brigade) { res.status(404).json({ error: 'Brigade not found' }); return }

        const isOwner  = brigade.organizer_id === req.user!.sub
        const isMember = brigade.doctors.some(bd => bd.doctor_id === req.user!.sub)
        if (!isOwner && !isMember) { res.status(403).json({ error: 'Forbidden' }); return }

        res.json({
          ...brigade,
          doctors: brigade.doctors.map(bd => ({
            doctor_id: bd.doctor_id,
            name:      bd.doctor.user.name,
            joined_at: bd.joined_at,
          })),
        })
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.post(
    '/:id/join',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = z.object({ join_code: z.string().length(6) }).safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'join_code (6 chars) required' }); return }
      try {
        await service.joinBrigade(req.user!.sub, req.params.id, parsed.data.join_code)
        res.status(201).send()
      } catch (err: any) {
        if (err?.code === 'INVALID_CODE')  { res.status(400).json({ error: 'Invalid join code' }); return }
        if (err?.code === 'ALREADY_JOINED') { res.status(409).json({ error: 'Already joined' }); return }
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/:id/dashboard',
    requireAuth,
    requireBrigadeOwner(db),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const dashboard = await service.getDashboard(req.params.id)
        res.json(dashboard)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  router.get(
    '/:id/report',
    requireAuth,
    requireBrigadeOwner(db),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const report = await service.getReport(req.params.id)
        res.json(report)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  return router
}
```

- [ ] **Step 4: Run tests — all 12 must pass**

```bash
cd packages/api && npx vitest run src/routes/brigades.test.ts
```

Expected: 12 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/brigades.ts packages/api/src/routes/brigades.test.ts
git commit -m "feat(api): add /api/brigades routes with 12 tests"
```

---

## Task 5: sync.ts route + tests

**Files:**
- Create: `packages/api/src/routes/sync.ts`
- Create: `packages/api/src/routes/sync.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/api/src/routes/sync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language } from '@prisma/client'

const SECRET     = 'test-secret-medicoya-min-32-chars-ok'
const DOC_ID     = 'doctor-uuid-1'
const PAT_ID     = 'patient-uuid-1'
const BRIGADE_ID = '00000000-0000-0000-0000-000000000001'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const validItem = {
  local_id:      'local-1',
  patient_phone: '+50499111111',
  patient_name:  'María López',
  symptoms_text: 'Headache',
  diagnosis:     'Tension headache',
  created_at:    '2026-05-10T10:00:00Z',
}

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
    create: vi.fn(),
  },
  prescription: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}

function makeTestApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => { vi.clearAllMocks() })

// --- POST /consultations ---

describe('POST /api/sync/consultations', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .send({ brigade_id: BRIGADE_ID, consultations: [] })
    expect(res.status).toBe(401)
  })

  it('returns 403 when doctor is not a brigade member', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue(null)
    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ brigade_id: BRIGADE_ID, consultations: [] })
    expect(res.status).toBe(403)
  })

  it('returns 200 with empty arrays for empty consultation list', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({ brigade_id: BRIGADE_ID, consultations: [] })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ accepted: [], rejected: [] })
  })

  it('returns 200 with all 3 local_ids in accepted for valid consultations', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    mockDb.user.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.patient.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb))
    mockDb.consultation.create.mockResolvedValue({ id: 'cons-1' })

    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({
        brigade_id: BRIGADE_ID,
        consultations: [
          { ...validItem, local_id: 'local-1' },
          { ...validItem, local_id: 'local-2', patient_phone: '+50499222222' },
          { ...validItem, local_id: 'local-3', patient_phone: '+50499333333' },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toHaveLength(3)
    expect(res.body.accepted).toContain('local-1')
    expect(res.body.accepted).toContain('local-2')
    expect(res.body.accepted).toContain('local-3')
    expect(res.body.rejected).toHaveLength(0)
  })

  it('accepts both when same patient_phone appears twice — links to same patient row', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    const mockUser = { id: PAT_ID }
    mockDb.user.upsert.mockResolvedValue(mockUser)
    mockDb.patient.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb))
    mockDb.consultation.create.mockResolvedValue({ id: 'cons-1' })

    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({
        brigade_id: BRIGADE_ID,
        consultations: [
          { ...validItem, local_id: 'local-1', patient_phone: '+50499111111' },
          { ...validItem, local_id: 'local-2', patient_phone: '+50499111111' },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toHaveLength(2)
    expect(res.body.rejected).toHaveLength(0)
    expect(mockDb.user.upsert).toHaveBeenCalledTimes(2)
  })

  it('returns 200 with 1 accepted and 1 rejected when one item fails', async () => {
    mockDb.brigadeDoctor.findUnique.mockResolvedValue({ brigade_id: BRIGADE_ID, doctor_id: DOC_ID })
    mockDb.user.upsert
      .mockResolvedValueOnce({ id: PAT_ID })
      .mockRejectedValueOnce(new Error('DB connection lost'))
    mockDb.patient.upsert.mockResolvedValue({ id: PAT_ID })
    mockDb.$transaction.mockImplementation(async (fn: any) => fn(mockDb))
    mockDb.consultation.create.mockResolvedValue({ id: 'cons-1' })

    const res = await request(makeTestApp())
      .post('/api/sync/consultations')
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
      .send({
        brigade_id: BRIGADE_ID,
        consultations: [
          { ...validItem, local_id: 'local-1' },
          { ...validItem, local_id: 'local-2', patient_phone: '+50499222222' },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.accepted).toContain('local-1')
    expect(res.body.rejected).toHaveLength(1)
    expect(res.body.rejected[0].local_id).toBe('local-2')
    expect(res.body.rejected[0].reason).toBe('DB connection lost')
  })
})

// --- GET /brigade/:id ---

describe('GET /api/sync/brigade/:id', () => {
  it('returns 200 with brigade + doctor list for member', async () => {
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
    const res = await request(makeTestApp())
      .get(`/api/sync/brigade/${brigadeId}`)
      .set('Authorization', `Bearer ${makeToken(DOC_ID, Role.doctor)}`)
    expect(res.status).toBe(200)
    expect(res.body.brigade.name).toBe('Brigada Norte')
    expect(res.body.doctors).toHaveLength(1)
    expect(res.body.doctors[0].id).toBe(DOC_ID)
    expect(res.body.doctors[0].name).toBe('Dr. Juan')
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd packages/api && npx vitest run src/routes/sync.test.ts
```

Expected: tests fail because `sync.ts` does not exist yet.

- [ ] **Step 3: Create the route**

Create `packages/api/src/routes/sync.ts`:

```typescript
import { Router, Request, Response } from 'express'
import { PrismaClient, Role } from '@prisma/client'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/requireAuth'
import { requireBrigadeMember } from '../middleware/requireBrigade'
import { BrigadeService } from '../services/BrigadeService'

const syncSchema = z.object({
  brigade_id: z.string().uuid(),
  consultations: z.array(z.object({
    local_id:      z.string().min(1),
    patient_phone: z.string().min(1),
    patient_name:  z.string().min(1),
    symptoms_text: z.string().optional(),
    diagnosis:     z.string().optional(),
    medications:   z.array(z.object({
      name:      z.string(),
      dose:      z.string(),
      frequency: z.string(),
    })).optional(),
    created_at: z.string().datetime(),
  })).min(0).max(100),
})

export function createSyncRouter(db: PrismaClient): Router {
  const router  = Router()
  const service = new BrigadeService(db)

  router.post(
    '/consultations',
    requireAuth,
    requireRole(Role.doctor),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = syncSchema.safeParse(req.body)
      if (!parsed.success) { res.status(400).json({ error: 'Invalid request body' }); return }

      const { brigade_id, consultations } = parsed.data

      const membership = await db.brigadeDoctor.findUnique({
        where: { brigade_id_doctor_id: { brigade_id, doctor_id: req.user!.sub } },
      })
      if (!membership) { res.status(403).json({ error: 'Forbidden' }); return }

      const result = await service.syncConsultations(req.user!.sub, brigade_id, consultations)
      res.json(result)
    }
  )

  router.get(
    '/brigade/:id',
    requireAuth,
    requireBrigadeMember(db),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const seed = await service.getBrigadeSeed(req.params.id)
        if (!seed) { res.status(404).json({ error: 'Brigade not found' }); return }
        res.json(seed)
      } catch {
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  return router
}
```

- [ ] **Step 4: Run tests — all 7 must pass**

```bash
cd packages/api && npx vitest run src/routes/sync.test.ts
```

Expected: 7 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/sync.ts packages/api/src/routes/sync.test.ts
git commit -m "feat(api): add /api/sync routes with 7 tests"
```

---

## Task 6: Wire app.ts + full test run

**Files:**
- Modify: `packages/api/src/app.ts`

- [ ] **Step 1: Add imports and mount routes**

In `packages/api/src/app.ts`, add two import lines after the existing `createRatingsRouter` import:

```typescript
import { createBrigadesRouter } from './routes/brigades'
import { createSyncRouter }     from './routes/sync'
```

Add two `app.use` lines after `app.use('/api/ratings', createRatingsRouter(db))`:

```typescript
app.use('/api/brigades', createBrigadesRouter(db))
app.use('/api/sync',     createSyncRouter(db))
```

The complete updated `app.ts`:

```typescript
import express from 'express'
import helmet from 'helmet'
import path from 'path'
import type { PrismaClient } from '@prisma/client'
import type { Server } from 'socket.io'
import { AuthService } from './services/AuthService'
import { ConsultationService } from './services/ConsultationService'
import { PrescriptionService } from './services/PrescriptionService'
import { UploadService } from './services/UploadService'
import { NotificationService } from './services/NotificationService'
import { otpService } from './services/OtpService'
import { prisma as defaultPrisma } from './lib/prisma'
import { createAuthRouter } from './routes/auth'
import { createDoctorsRouter } from './routes/doctors'
import { createAdminRouter } from './routes/admin'
import { createConsultationsRouter } from './routes/consultations'
import { createPrescriptionsRouter } from './routes/prescriptions'
import { createNotificationsRouter } from './routes/notifications'
import { createRatingsRouter }       from './routes/ratings'
import { createFhirRouter }         from './routes/fhir'
import { createBrigadesRouter }     from './routes/brigades'
import { createSyncRouter }         from './routes/sync'

interface AppDeps {
  authService?:         AuthService
  consultationService?: ConsultationService
  prescriptionService?: PrescriptionService
  uploadService?:       UploadService
  notificationService?: NotificationService
  db?:                  PrismaClient
  io?:                  Server
}

export function createApp(deps?: AppDeps): { app: express.Express } {
  const app = express()

  app.use('/admin', express.static(path.join(__dirname, '../../../apps/admin/out')))
  app.get('/admin/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../../apps/admin/out/index.html'))
  })

  app.use(helmet())
  app.use(express.json({ limit: '10kb' }))

  const db                  = deps?.db                  ?? defaultPrisma
  const authService         = deps?.authService         ?? new AuthService(otpService, db)
  const consultationService = deps?.consultationService ?? new ConsultationService(db, deps?.io, deps?.notificationService)
  const prescriptionService = deps?.prescriptionService ?? new PrescriptionService(db)
  const uploadService       = deps?.uploadService       ?? new UploadService()

  app.use('/api/auth',          createAuthRouter(authService))
  app.use('/api/doctors',       createDoctorsRouter(db))
  app.use('/api/admin',         createAdminRouter(db))
  app.use('/api/consultations', createConsultationsRouter(consultationService, uploadService))
  app.use('/api/prescriptions', createPrescriptionsRouter(prescriptionService))
  app.use('/api/notifications', createNotificationsRouter(db))
  app.use('/api/ratings',       createRatingsRouter(db))
  app.use('/fhir/R4',           createFhirRouter(db))
  app.use('/api/brigades',      createBrigadesRouter(db))
  app.use('/api/sync',          createSyncRouter(db))
  app.get('/health', (_req, res) => res.json({ ok: true }))

  return { app }
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd packages/api && npx vitest run
```

Expected: all tests pass (existing suite + 12 brigade + 7 sync = 19 new tests on top of existing).

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/app.ts
git commit -m "feat(api): wire /api/brigades and /api/sync routers into app"
```

---
