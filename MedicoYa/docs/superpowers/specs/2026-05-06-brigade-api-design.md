# Brigade API — Design Spec

**Date:** 2026-05-06
**Project:** MédicoYa
**Scope:** Sub-project 1 of 3 — Brigade API (schema + endpoints + sync). Mobile offline UI and coordinator dashboard are separate sub-projects.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Coordinator role | New `coordinator` value in `Role` enum |
| Consultation storage | Extend existing `Consultation` table with `mode`, `brigade_id`, `local_id`, `synced_at` |
| Mode enum | New `ConsultationMode` enum: `telemedicine` \| `brigade` |
| Dashboard delivery | REST polling — `GET /api/brigades/:id/dashboard` (no socket) |
| Sync failure strategy | Per-item transactions — failures don't affect valid records; response lists accepted/rejected `local_id`s |
| Duplicate patient on sync | Both consultations accepted, linked to same `Patient` row (found by phone); `registered_by` set on Patient if newly created |
| Join code | 6-char uppercase alphanumeric, generated with nanoid |
| Brigade status | `active` \| `closed` enum |

---

## 2. Data Model

### Schema changes (`packages/api/prisma/schema.prisma`)

**Extend `Role` enum:**
```prisma
enum Role {
  patient
  doctor
  admin
  coordinator
}
```

**New `ConsultationMode` enum:**
```prisma
enum ConsultationMode {
  telemedicine
  brigade
}
```

**New `BrigadeStatus` enum:**
```prisma
enum BrigadeStatus {
  active
  closed
}
```

**New `Brigade` model:**
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
```

**New `BrigadeDoctor` model:**
```prisma
model BrigadeDoctor {
  brigade_id String
  doctor_id  String
  joined_at  DateTime @default(now())

  brigade Brigade @relation(fields: [brigade_id], references: [id], onDelete: Cascade)
  doctor  Doctor  @relation(fields: [doctor_id], references: [id], onDelete: Cascade)

  @@id([brigade_id, doctor_id])
}
```

**Add to `Consultation` model:**
```prisma
  mode       ConsultationMode @default(telemedicine)
  brigade_id String?
  local_id   String?
  synced_at  DateTime?

  brigade Brigade? @relation(fields: [brigade_id], references: [id])
```

**Add back-relations:**
```prisma
// On User:
brigades Brigade[]

// On Doctor:
brigadeMemberships BrigadeDoctor[]
```

### Migration SQL

```sql
-- Enums
CREATE TYPE "ConsultationMode" AS ENUM ('telemedicine', 'brigade');
CREATE TYPE "BrigadeStatus"    AS ENUM ('active', 'closed');
ALTER TYPE "Role" ADD VALUE 'coordinator';

-- Brigade table
CREATE TABLE "Brigade" (
  "id"           TEXT        NOT NULL PRIMARY KEY,
  "name"         TEXT        NOT NULL,
  "organizer_id" TEXT        NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
  "community"    TEXT        NOT NULL,
  "municipality" TEXT,
  "department"   TEXT,
  "start_date"   TIMESTAMP(3) NOT NULL,
  "end_date"     TIMESTAMP(3) NOT NULL,
  "join_code"    TEXT        NOT NULL UNIQUE,
  "status"       "BrigadeStatus" NOT NULL DEFAULT 'active',
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Brigade_organizer_id_idx" ON "Brigade"("organizer_id");

-- BrigadeDoctor join table
CREATE TABLE "BrigadeDoctor" (
  "brigade_id" TEXT NOT NULL REFERENCES "Brigade"("id") ON DELETE CASCADE,
  "doctor_id"  TEXT NOT NULL REFERENCES "Doctor"("id") ON DELETE CASCADE,
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BrigadeDoctor_pkey" PRIMARY KEY ("brigade_id", "doctor_id")
);
CREATE INDEX "BrigadeDoctor_doctor_id_idx" ON "BrigadeDoctor"("doctor_id");

-- Consultation additions
ALTER TABLE "Consultation"
  ADD COLUMN "mode"       "ConsultationMode" NOT NULL DEFAULT 'telemedicine',
  ADD COLUMN "brigade_id" TEXT REFERENCES "Brigade"("id") ON DELETE SET NULL,
  ADD COLUMN "local_id"   TEXT,
  ADD COLUMN "synced_at"  TIMESTAMP(3);
CREATE INDEX "Consultation_brigade_id_idx" ON "Consultation"("brigade_id");
```

---

## 3. Middleware

### `packages/api/src/middleware/requireBrigade.ts`

Two Express middlewares — both load from `BrigadeDoctor` / `Brigade` and attach to `req`:

**`requireBrigadeMember(brigadeId: string)`**
- Checks `BrigadeDoctor` row exists for `(brigadeId, req.user!.sub)`
- Returns 403 if not a member

**`requireBrigadeOwner(brigadeId: string)`**
- Checks `Brigade.organizer_id === req.user!.sub`
- Returns 403 if not the organizer

Both take `brigadeId` as a factory parameter (called with `req.params.id` at route registration).

---

## 4. Service

### `packages/api/src/services/BrigadeService.ts`

```typescript
export class BrigadeService {
  constructor(private db: PrismaClient) {}

  async createBrigade(organizerId: string, data: CreateBrigadeInput): Promise<Brigade>
  async joinBrigade(doctorId: string, brigadeId: string, joinCode: string): Promise<void>
  async getDashboard(brigadeId: string): Promise<BrigadeDashboard>
  async getReport(brigadeId: string): Promise<BrigadeReport>
  async syncConsultations(doctorId: string, brigadeId: string, items: SyncItem[]): Promise<SyncResult>
  async getBrigadeSeed(brigadeId: string): Promise<BrigadeSeed>
}
```

**`createBrigade`:** generate `join_code` = `nanoid(6).toUpperCase()` (alphanumeric, retry on collision — Prisma P2002 → regenerate once). Create `Brigade` row.

**`joinBrigade`:** verify `brigade.join_code === joinCode` (case-insensitive) → 400 if wrong. Check no existing `BrigadeDoctor` row → 409 if duplicate. Create `BrigadeDoctor`.

**`getDashboard`:** single query grouping consultations by status for the brigade:
```typescript
{
  total:          number,  // all consultations in brigade
  attended:       number,  // status = completed
  waiting:        number,  // status = pending
  active_doctors: number,  // distinct doctor_ids with consultation today
}
```

**`getReport`:** aggregate consultations grouped by `diagnosis` (top 10 by count), total patient count, count by registration mode (`self` vs `brigade_doctor`).

**`syncConsultations`:** for each item:
1. Find or create `Patient` by `patient_phone` (upsert — if new, set `registered_by = doctorId`, `registration_mode = brigade_doctor`)
2. Wrap in `db.$transaction`: create `Consultation` (mode=brigade, brigade_id, local_id, synced_at=now) + create `Prescription` if `medications` present
3. On success → push `local_id` to `accepted[]`
4. On any error → push `{ local_id, reason: err.message }` to `rejected[]`
5. Return `{ accepted, rejected }`

**`getBrigadeSeed`:** returns brigade info + full doctor list for the brigade (for offline download before entering brigade mode).

---

## 5. API Endpoints

### `packages/api/src/routes/brigades.ts` — mounted at `/api/brigades`

#### `POST /`
- Auth: `requireAuth` + `requireRole(Role.coordinator)`
- Body (zod):
  ```typescript
  z.object({
    name:         z.string().min(1).max(100),
    community:    z.string().min(1).max(100),
    municipality: z.string().max(100).optional(),
    department:   z.string().max(100).optional(),
    start_date:   z.string().datetime(),
    end_date:     z.string().datetime(),
  })
  ```
- Calls `BrigadeService.createBrigade`
- Returns 201 + `{ id, join_code, name, ... }`

#### `GET /:id`
- Auth: `requireAuth`; inside handler verify caller is either `Brigade.organizer_id` OR has a `BrigadeDoctor` row — return 403 if neither
- Returns brigade detail + array of `{ doctor_id, name, joined_at }`
- 404 if brigade not found

#### `POST /:id/join`
- Auth: `requireAuth` + `requireRole(Role.doctor)`
- Body: `z.object({ join_code: z.string().length(6) })`
- Calls `BrigadeService.joinBrigade`
- Returns 201 on success, 400 wrong code, 409 already joined

#### `GET /:id/dashboard`
- Auth: `requireAuth` + `requireBrigadeOwner`
- Returns `{ total, attended, waiting, active_doctors }`

#### `GET /:id/report`
- Auth: `requireAuth` + `requireBrigadeOwner`
- Returns `{ patient_count, by_registration_mode, top_diagnoses: [{ diagnosis, count }] }`

### `packages/api/src/routes/sync.ts` — mounted at `/api/sync`

#### `POST /consultations`
- Auth: `requireAuth` + `requireRole(Role.doctor)`
- Body (zod):
  ```typescript
  z.object({
    brigade_id:    z.string().uuid(),
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
      created_at:    z.string().datetime(),
    })).min(0).max(100),
  })
  ```
- Guard (in handler, not middleware — brigade_id is in body): verify `BrigadeDoctor` row exists for `(body.brigade_id, req.user!.sub)`; return 403 if not
- Calls `BrigadeService.syncConsultations`
- Always returns 200: `{ accepted: string[], rejected: { local_id: string; reason: string }[] }`

#### `GET /brigade/:id`
- Auth: `requireAuth` + `requireBrigadeMember`
- Calls `BrigadeService.getBrigadeSeed`
- Returns `{ brigade: {...}, doctors: [{ id, name }] }`

---

## 6. Tests

### `packages/api/src/routes/brigades.test.ts` — 12 tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `POST /` no auth | 401 |
| 2 | `POST /` patient role | 403 |
| 3 | `POST /` coordinator creates brigade | 201 + `join_code` in body |
| 4 | `GET /:id` doctor not in brigade | 403 |
| 5 | `GET /:id` coordinator gets own brigade | 200 + doctor list |
| 6 | `POST /:id/join` wrong join_code | 400 |
| 7 | `POST /:id/join` already joined | 409 |
| 8 | `POST /:id/join` doctor joins with correct code | 201 |
| 9 | `GET /:id/dashboard` non-coordinator | 403 |
| 10 | `GET /:id/dashboard` coordinator gets stats | 200 + `{ total, attended, waiting, active_doctors }` |
| 11 | `GET /:id/report` coordinator gets report | 200 + `top_diagnoses` array |
| 12 | `GET /:id/report` non-coordinator | 403 |

### `packages/api/src/routes/sync.test.ts` — 7 tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `POST /consultations` no auth | 401 |
| 2 | `POST /consultations` doctor not in brigade | 403 |
| 3 | `POST /consultations` empty array | 200 `{ accepted: [], rejected: [] }` |
| 4 | `POST /consultations` 3 valid consultations | 200, all 3 `local_id`s in `accepted` |
| 5 | `POST /consultations` duplicate patient phone | 200, both accepted, linked to same patient |
| 6 | `POST /consultations` 1 valid + 1 invalid (missing phone) | 200, 1 accepted + 1 rejected with reason |
| 7 | `GET /brigade/:id` doctor in brigade | 200 + brigade + doctor list |

---

## 7. File Map

| Action | File |
|--------|------|
| MOD | `packages/api/prisma/schema.prisma` |
| NEW | `packages/api/prisma/migrations/<timestamp>_add_brigades/migration.sql` |
| NEW | `packages/api/src/middleware/requireBrigade.ts` |
| NEW | `packages/api/src/services/BrigadeService.ts` |
| NEW | `packages/api/src/routes/brigades.ts` |
| NEW | `packages/api/src/routes/brigades.test.ts` |
| NEW | `packages/api/src/routes/sync.ts` |
| NEW | `packages/api/src/routes/sync.test.ts` |
| MOD | `packages/api/src/app.ts` |

---

## 8. Out of Scope

- Mobile offline UI (Sub-project 2)
- Coordinator dashboard web UI (Sub-project 3)
- PDF report generation (Sub-project 3)
- Brigade status transitions beyond active/closed
- Deleting or editing brigades
- Patient deduplication beyond same-brigade phone matching
