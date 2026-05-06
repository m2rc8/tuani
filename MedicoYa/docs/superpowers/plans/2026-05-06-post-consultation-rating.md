# Post-Consultation Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow patients to rate their doctor (1–5 stars + optional comment) after a consultation completes, displayed on PrescriptionScreen; doctor sees their own average on DoctorProfileScreen; admin sees averages in DoctorsTable.

**Architecture:** New `Rating` Prisma model (one per consultation, unique constraint). `POST /api/ratings` route guards status + ownership. Existing `GET /consultations/:id`, `GET /doctors/me`, and `GET /admin/doctors/approved` are enriched with rating data. Mobile PrescriptionScreen adds an inline rating widget below the prescription content.

**Tech Stack:** Prisma (Rating model), zod (validation), vitest + supertest (API tests), jest-expo + @testing-library/react-native (mobile tests).

---

## File Map

| Action | File |
|--------|------|
| MOD | `packages/api/prisma/schema.prisma` |
| NEW | `packages/api/prisma/migrations/<timestamp>_add_ratings/migration.sql` |
| NEW | `packages/api/src/routes/ratings.ts` |
| NEW | `packages/api/src/routes/ratings.test.ts` |
| MOD | `packages/api/src/app.ts` |
| MOD | `packages/api/src/services/ConsultationService.ts` |
| MOD | `packages/api/src/routes/doctors.ts` |
| MOD | `packages/api/src/routes/admin.ts` |
| MOD | `apps/mobile/src/lib/types.ts` |
| MOD | `apps/mobile/src/i18n/es.json` |
| MOD | `apps/mobile/src/i18n/en.json` |
| MOD | `apps/mobile/src/screens/patient/PrescriptionScreen.tsx` |
| MOD | `apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx` |
| MOD | `apps/admin/src/components/DoctorsTable.tsx` |
| NEW | `apps/mobile/src/__tests__/PrescriptionScreen.test.tsx` |

---

### Task 1: Rating model + migration

**Files:**
- Modify: `packages/api/prisma/schema.prisma`
- New: `packages/api/prisma/migrations/`

#### Context

The `Rating` model needs back-relations on `Consultation`, `Doctor`, and `Patient`. The migration creates the table with `ON DELETE CASCADE` on all FKs. No app code changes — just schema + migration + client regeneration.

- [ ] **Step 1: Add Rating model and back-relations to schema.prisma**

In `packages/api/prisma/schema.prisma`, make these 4 edits:

**Add to `Consultation` model** (after `prescription Prescription?` line):
```prisma
  rating       Rating?
```

**Add to `Doctor` model** (after `consultations Consultation[]` line):
```prisma
  ratings      Rating[]
```

**Add to `Patient` model** (after `consultations Consultation[]` line):
```prisma
  ratings      Rating[]
```

**Add new model** (after the `Prescription` model, at end of file):
```prisma
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
```

- [ ] **Step 2: Validate schema**

```bash
npx prisma validate --schema packages/api/prisma/schema.prisma
```

Expected: no errors.

- [ ] **Step 3: Run migration**

```bash
npm run db:migrate --workspace packages/api -- --name add_ratings
```

If no local DB is running (P1001 error), create the migration SQL manually. Create file `packages/api/prisma/migrations/<timestamp>_add_ratings/migration.sql` with:

```sql
CREATE TABLE "Rating" (
  "id"              TEXT NOT NULL PRIMARY KEY,
  "consultation_id" TEXT NOT NULL UNIQUE REFERENCES "Consultation"("id") ON DELETE CASCADE,
  "doctor_id"       TEXT NOT NULL REFERENCES "Doctor"("id") ON DELETE CASCADE,
  "patient_id"      TEXT NOT NULL REFERENCES "Patient"("id") ON DELETE CASCADE,
  "stars"           INTEGER NOT NULL,
  "comment"         TEXT,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "Rating_doctor_id_idx"  ON "Rating"("doctor_id");
CREATE INDEX "Rating_patient_id_idx" ON "Rating"("patient_id");
```

- [ ] **Step 4: Regenerate Prisma client**

```bash
npm run db:generate --workspace packages/api
```

Expected: no errors. Generated client now includes `rating` delegate.

- [ ] **Step 5: Run existing API tests to confirm no regression**

```bash
npm run test --workspace packages/api 2>&1 | tail -8
```

Expected: 132 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/api/prisma/schema.prisma packages/api/prisma/migrations/ packages/api/package.json package-lock.json
git commit -m "feat(api): add Rating model + migration"
```

---

### Task 2: POST /api/ratings route + tests

**Files:**
- Create: `packages/api/src/routes/ratings.ts`
- Create: `packages/api/src/routes/ratings.test.ts`
- Modify: `packages/api/src/app.ts`

#### Context

The route is `POST /api/ratings`. Guards run in this order: zod validation → consultation exists → patient owns it → consultation is completed → doctor_id not null → create (catch P2002 for 409). Test pattern matches `notifications.test.ts` — use `createApp({ db: mockDb as any })` and JWT tokens. JWT secret in tests is `'test-secret-medicoya-min-32-chars-ok'`.

- [ ] **Step 1: Write failing tests**

Create `packages/api/src/routes/ratings.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { createApp } from '../app'
import { Role, Language, ConsultationStatus } from '@prisma/client'

const SECRET  = 'test-secret-medicoya-min-32-chars-ok'
const PATIENT = 'patient-uuid-1'
const DOCTOR  = 'doctor-uuid-1'
const CONS_ID = 'cons-uuid-1'

function makeToken(sub: string, role: Role) {
  return jwt.sign({ sub, role, preferred_language: Language.es }, SECRET, { expiresIn: '7d' })
}

const completedConsultation = {
  id:         CONS_ID,
  patient_id: PATIENT,
  doctor_id:  DOCTOR,
  status:     ConsultationStatus.completed,
}

const mockDb = {
  consultation: { findUnique: vi.fn() },
  rating:       { create: vi.fn().mockResolvedValue({ id: 'r-1' }) },
}

function makeApp() {
  const { app } = createApp({ db: mockDb as any })
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.consultation.findUnique.mockResolvedValue(completedConsultation)
  mockDb.rating.create.mockResolvedValue({ id: 'r-1' })
})

describe('POST /api/ratings', () => {
  it('returns 401 without auth', async () => {
    const res = await request(makeApp()).post('/api/ratings').send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(401)
  })

  it('returns 403 for doctor role', async () => {
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(DOCTOR, Role.doctor)}`)
      .send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(403)
  })

  it('returns 400 for invalid stars (0)', async () => {
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 0 })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid stars (6)', async () => {
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 6 })
    expect(res.status).toBe(400)
  })

  it('returns 404 when consultation not found', async () => {
    mockDb.consultation.findUnique.mockResolvedValue(null)
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(404)
  })

  it('returns 403 when patient does not own consultation', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...completedConsultation, patient_id: 'other-patient' })
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(403)
  })

  it('returns 409 when consultation not completed', async () => {
    mockDb.consultation.findUnique.mockResolvedValue({ ...completedConsultation, status: ConsultationStatus.active })
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 4 })
    expect(res.status).toBe(409)
  })

  it('returns 201 on success with stars and comment', async () => {
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 4, comment: 'Great doctor' })
    expect(res.status).toBe(201)
    expect(mockDb.rating.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        consultation_id: CONS_ID,
        doctor_id:       DOCTOR,
        patient_id:      PATIENT,
        stars:           4,
        comment:         'Great doctor',
      }),
    }))
  })

  it('returns 409 on duplicate rating (P2002)', async () => {
    mockDb.rating.create.mockRejectedValue({ code: 'P2002' })
    const res = await request(makeApp())
      .post('/api/ratings')
      .set('Authorization', `Bearer ${makeToken(PATIENT, Role.patient)}`)
      .send({ consultation_id: CONS_ID, stars: 5 })
    expect(res.status).toBe(409)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test --workspace packages/api -- --reporter=verbose 2>&1 | Select-Object -Last 20
```

Expected: 9 failures — route not registered.

- [ ] **Step 3: Implement ratings route**

Create `packages/api/src/routes/ratings.ts`:

```typescript
import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { PrismaClient, ConsultationStatus, Role } from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/requireAuth'

const ratingSchema = z.object({
  consultation_id: z.string().uuid(),
  stars:           z.number().int().min(1).max(5),
  comment:         z.string().max(300).optional(),
})

export function createRatingsRouter(db: PrismaClient): Router {
  const router = Router()

  router.post(
    '/',
    requireAuth,
    requireRole(Role.patient),
    async (req: Request, res: Response): Promise<void> => {
      const parsed = ratingSchema.safeParse(req.body)
      if (!parsed.success) {
        res.status(400).json({ error: 'Invalid request body' })
        return
      }
      const { consultation_id, stars, comment } = parsed.data

      const consultation = await db.consultation.findUnique({ where: { id: consultation_id } })
      if (!consultation) {
        res.status(404).json({ error: 'Consultation not found' })
        return
      }
      if (consultation.patient_id !== req.user!.sub) {
        res.status(403).json({ error: 'Not your consultation' })
        return
      }
      if (consultation.status !== ConsultationStatus.completed) {
        res.status(409).json({ error: 'Consultation not completed' })
        return
      }
      if (!consultation.doctor_id) {
        res.status(409).json({ error: 'Consultation has no doctor' })
        return
      }

      try {
        await db.rating.create({
          data: {
            id:              randomUUID(),
            consultation_id,
            doctor_id:       consultation.doctor_id,
            patient_id:      req.user!.sub,
            stars,
            comment,
          },
        })
        res.status(201).send()
      } catch (err: any) {
        if (err?.code === 'P2002') {
          res.status(409).json({ error: 'Already rated' })
          return
        }
        res.status(500).json({ error: 'Internal server error' })
      }
    }
  )

  return router
}
```

- [ ] **Step 4: Register route in app.ts**

In `packages/api/src/app.ts`:

Add import (after the `createNotificationsRouter` import line):
```typescript
import { createRatingsRouter } from './routes/ratings'
```

Add route registration (after the `/api/notifications` line):
```typescript
app.use('/api/ratings', createRatingsRouter(db))
```

- [ ] **Step 5: Run all API tests**

```bash
npm run test --workspace packages/api 2>&1 | tail -8
```

Expected: 141 tests pass (132 existing + 9 new).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/ratings.ts packages/api/src/routes/ratings.test.ts packages/api/src/app.ts
git commit -m "feat(api): POST /api/ratings — patient rates doctor after consultation"
```

---

### Task 3: Enrich existing API endpoints with rating data

**Files:**
- Modify: `packages/api/src/services/ConsultationService.ts`
- Modify: `packages/api/src/routes/doctors.ts`
- Modify: `packages/api/src/routes/admin.ts`

#### Context

Three existing endpoints need rating data:
1. `GET /api/consultations/:id` — add `rating` object to response (used by PrescriptionScreen to know if already rated)
2. `GET /api/doctors/me` — add `avg_rating` and `rating_count` (used by DoctorProfileScreen)
3. `GET /api/admin/doctors/approved` — add `avg_rating` and `rating_count` per doctor (used by DoctorsTable)

All changes are additive — no breaking changes to existing consumers.

- [ ] **Step 1: Enrich ConsultationService.getConsultation**

In `packages/api/src/services/ConsultationService.ts`, find `getConsultation`:

```typescript
async getConsultation(id: string, userId: string) {
  const c = await this.db.consultation.findUnique({
    where: { id },
    include: { prescription: true },
  })
```

Change the `include` to:
```typescript
  const c = await this.db.consultation.findUnique({
    where:   { id },
    include: { prescription: true, rating: true },
  })
```

- [ ] **Step 2: Enrich GET /doctors/me**

In `packages/api/src/routes/doctors.ts`, find the `/me` handler body and replace it:

Current:
```typescript
    const doctor = await db.doctor.findUnique({
      where:   { id: req.user!.sub },
      include: { user: { select: { name: true, phone: true } } },
    })
    if (!doctor) { res.status(404).json({ error: 'Doctor not found' }); return }
    res.json(doctor)
```

Replace with:
```typescript
    const [doctor, ratingAgg] = await Promise.all([
      db.doctor.findUnique({
        where:   { id: req.user!.sub },
        include: { user: { select: { name: true, phone: true } } },
      }),
      db.rating.aggregate({
        where:  { doctor_id: req.user!.sub },
        _avg:   { stars: true },
        _count: { stars: true },
      }),
    ])
    if (!doctor) { res.status(404).json({ error: 'Doctor not found' }); return }
    res.json({
      ...doctor,
      avg_rating:   ratingAgg._avg.stars,
      rating_count: ratingAgg._count.stars,
    })
```

- [ ] **Step 3: Enrich GET /admin/doctors/approved**

In `packages/api/src/routes/admin.ts`, find the `/doctors/approved` handler body and replace it:

Current:
```typescript
      const doctors = await db.doctor.findMany({
        where:   { approved_at: { not: null }, rejected_at: null },
        include: { user: { select: { name: true, phone: true } } },
      })
      res.json(doctors)
```

Replace with:
```typescript
      const [doctors, ratings] = await Promise.all([
        db.doctor.findMany({
          where:   { approved_at: { not: null }, rejected_at: null },
          include: { user: { select: { name: true, phone: true } } },
        }),
        db.rating.groupBy({
          by:     ['doctor_id'],
          _avg:   { stars: true },
          _count: { stars: true },
        }),
      ])
      const ratingMap = new Map(ratings.map(r => [r.doctor_id, r]))
      res.json(doctors.map(d => {
        const r = ratingMap.get(d.id)
        return {
          ...d,
          avg_rating:   r?._avg.stars   ?? null,
          rating_count: r?._count.stars ?? 0,
        }
      }))
```

- [ ] **Step 4: Run all API tests**

```bash
npm run test --workspace packages/api 2>&1 | tail -8
```

Expected: 141 tests pass. The existing ConsultationService tests mock the db — `include: { prescription: true, rating: true }` is passed to the mock which ignores it, so tests remain green.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/services/ConsultationService.ts packages/api/src/routes/doctors.ts packages/api/src/routes/admin.ts
git commit -m "feat(api): enrich consultation, doctor/me, and admin endpoints with rating data"
```

---

### Task 4: Mobile types + i18n keys

**Files:**
- Modify: `apps/mobile/src/lib/types.ts`
- Modify: `apps/mobile/src/i18n/es.json`
- Modify: `apps/mobile/src/i18n/en.json`

#### Context

No tests needed for this task — pure data additions. The `Rating` interface is needed before PrescriptionScreen is updated (Task 5). The i18n keys follow the existing pattern: nested under `"consultation"` block.

- [ ] **Step 1: Add Rating interface to types.ts**

In `apps/mobile/src/lib/types.ts`, add after the `Prescription` interface:

```typescript
export interface Rating {
  id:         string
  stars:      number
  comment:    string | null
  created_at: string
}
```

And add `rating` field to `ConsultationDetail` (add after `prescription: Prescription | null`):

```typescript
  rating: Rating | null
```

- [ ] **Step 2: Add i18n keys to es.json**

In `apps/mobile/src/i18n/es.json`, inside the `"consultation"` block (after `"share": "Compartir receta"`):

```json
    "rate_title":   "Califica tu consulta",
    "rate_submit":  "Enviar calificación",
    "rate_thanks":  "¡Gracias por tu calificación!",
    "rate_comment": "Comentario (opcional)",
    "avg_rating":   "calificaciones"
```

- [ ] **Step 3: Add i18n keys to en.json**

In `apps/mobile/src/i18n/en.json`, inside the `"consultation"` block (after `"share": "Share prescription"`):

```json
    "rate_title":   "Rate your consultation",
    "rate_submit":  "Submit rating",
    "rate_thanks":  "Thanks for your rating!",
    "rate_comment": "Comment (optional)",
    "avg_rating":   "ratings"
```

- [ ] **Step 4: Run mobile tests to confirm no regression**

```bash
npm test --workspace apps/mobile 2>&1 | tail -8
```

Expected: 88 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/lib/types.ts apps/mobile/src/i18n/es.json apps/mobile/src/i18n/en.json
git commit -m "feat(mobile): add Rating type and i18n keys for rating UI"
```

---

### Task 5: PrescriptionScreen rating widget + tests

**Files:**
- Create: `apps/mobile/src/__tests__/PrescriptionScreen.test.tsx`
- Modify: `apps/mobile/src/screens/patient/PrescriptionScreen.tsx`

#### Context

The rating widget appears below the prescription content. State: `selectedStars` (0 = none), `comment`, `submitting`, `submitted`. When `detail.rating !== null` OR `submitted === true`, show the thanks message instead of the picker. Test file must mock `react-qr-code` (used in the screen) and `api`.

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/__tests__/PrescriptionScreen.test.tsx`:

```typescript
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import PrescriptionScreen from '../screens/patient/PrescriptionScreen'

jest.mock('../lib/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

jest.mock('react-qr-code', () => ({ __esModule: true, default: () => null }))

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), deleteItemAsync: jest.fn(),
}))

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}))

import api from '../lib/api'
const mockedApi = api as jest.Mocked<typeof api>

const CONS_ID = 'cons-1'
const route   = { params: { consultationId: CONS_ID } }

const baseDetail = {
  id: CONS_ID, patient_id: 'p-1', doctor_id: 'd-1',
  status: 'completed', symptoms_text: null, symptom_photo: null,
  diagnosis: 'Flu', diagnosis_code: null,
  created_at: '2026-05-06T00:00:00Z', completed_at: '2026-05-06T01:00:00Z',
  prescription: {
    id: 'rx-1', consultation_id: CONS_ID, qr_code: 'ABC123',
    medications: [{ name: 'Ibuprofen', dose: '400mg', frequency: 'TID' }],
    instructions: null, valid_until: '2026-06-05T00:00:00Z',
  },
  rating: null,
}

beforeEach(() => jest.clearAllMocks())

describe('PrescriptionScreen', () => {
  it('shows star picker when consultation is unrated', async () => {
    mockedApi.get.mockResolvedValue({ data: { ...baseDetail, rating: null } })
    const { getByTestId } = render(<PrescriptionScreen route={route} />)
    await waitFor(() => expect(getByTestId('star-1')).toBeTruthy())
    expect(getByTestId('rating-submit')).toBeTruthy()
  })

  it('submits rating and shows thanks message', async () => {
    mockedApi.get.mockResolvedValue({ data: { ...baseDetail, rating: null } })
    mockedApi.post.mockResolvedValue({})
    const { getByTestId, getByText } = render(<PrescriptionScreen route={route} />)
    await waitFor(() => getByTestId('star-4'))
    fireEvent.press(getByTestId('star-4'))
    fireEvent.press(getByTestId('rating-submit'))
    await waitFor(() =>
      expect(mockedApi.post).toHaveBeenCalledWith('/api/ratings', {
        consultation_id: CONS_ID, stars: 4, comment: '',
      })
    )
    await waitFor(() => getByText('consultation.rate_thanks'))
  })

  it('shows read-only thanks when already rated', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        ...baseDetail,
        rating: { id: 'r-1', stars: 3, comment: null, created_at: '2026-05-06T01:30:00Z' },
      },
    })
    const { queryByTestId, getByText } = render(<PrescriptionScreen route={route} />)
    await waitFor(() => getByText('consultation.rate_thanks'))
    expect(queryByTestId('rating-submit')).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace apps/mobile -- --testPathPattern=PrescriptionScreen 2>&1 | tail -15
```

Expected: 3 failures — testIDs not found.

- [ ] **Step 3: Implement updated PrescriptionScreen**

Replace `apps/mobile/src/screens/patient/PrescriptionScreen.tsx` with:

```typescript
import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, TextInput,
} from 'react-native'
import QRCode from 'react-qr-code'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import type { ConsultationDetail } from '../../lib/types'

export default function PrescriptionScreen({ route }: any) {
  const { t } = useTranslation()
  const { consultationId } = route.params as { consultationId: string }

  const [detail,        setDetail]        = useState<ConsultationDetail | null>(null)
  const [selectedStars, setSelectedStars] = useState(0)
  const [comment,       setComment]       = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [submitted,     setSubmitted]     = useState(false)

  useEffect(() => {
    api.get<ConsultationDetail>(`/api/consultations/${consultationId}`)
      .then(({ data }) => setDetail(data))
      .catch(() => {})
  }, [consultationId])

  if (!detail) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  const { diagnosis, prescription } = detail
  if (!prescription) return null

  const validUntil = prescription.valid_until
    ? new Date(prescription.valid_until).toLocaleDateString()
    : '—'

  const alreadyRated = detail.rating !== null || submitted

  async function submitRating() {
    if (selectedStars === 0 || submitting) return
    setSubmitting(true)
    try {
      await api.post('/api/ratings', {
        consultation_id: consultationId,
        stars:   selectedStars,
        comment,
      })
      setSubmitted(true)
    } catch {
      // silent — prescription stays visible
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>{t('consultation.prescription_title')}</Text>

      <View style={styles.section}>
        <Text style={styles.label}>{t('consultation.diagnosis')}</Text>
        <Text style={styles.value}>{diagnosis}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t('consultation.medications')}</Text>
        {prescription.medications.map((med, i) => (
          <Text key={i} style={styles.medication}>
            {med.name} — {med.dose} — {med.frequency}
          </Text>
        ))}
      </View>

      {prescription.instructions && (
        <View style={styles.section}>
          <Text style={styles.value}>{prescription.instructions}</Text>
        </View>
      )}

      <View style={styles.qrContainer}>
        <QRCode value={`MEDICOYA:${prescription.qr_code}`} size={180} />
      </View>

      <Text style={styles.validUntil}>
        {t('consultation.valid_until')}: {validUntil}
      </Text>

      <View style={styles.ratingSection}>
        {alreadyRated ? (
          <Text style={styles.ratingThanks}>{t('consultation.rate_thanks')}</Text>
        ) : (
          <>
            <Text style={styles.ratingTitle}>{t('consultation.rate_title')}</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity
                  key={i}
                  testID={`star-${i}`}
                  onPress={() => setSelectedStars(i)}
                >
                  <Text style={[styles.star, selectedStars >= i && styles.starActive]}>
                    {selectedStars >= i ? '★' : '☆'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              testID="rating-comment"
              style={styles.commentInput}
              placeholder={t('consultation.rate_comment')}
              value={comment}
              onChangeText={setComment}
              maxLength={300}
              multiline
            />
            <TouchableOpacity
              testID="rating-submit"
              style={[styles.submitBtn, (selectedStars === 0 || submitting) && styles.submitDisabled]}
              onPress={submitRating}
              disabled={selectedStars === 0 || submitting}
            >
              <Text style={styles.submitText}>{t('consultation.rate_submit')}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  loading:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container:     { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  heading:       { fontSize: 22, fontWeight: '700', marginBottom: 24 },
  section:       { marginBottom: 20 },
  label:         {
    fontSize: 11, color: '#94A3B8', textTransform: 'uppercase',
    fontWeight: '600', marginBottom: 6, letterSpacing: 0.5,
  },
  value:         { fontSize: 17, color: '#1E293B', fontWeight: '600' },
  medication:    { fontSize: 15, color: '#334155', marginBottom: 4 },
  qrContainer:   {
    alignItems: 'center', padding: 20,
    backgroundColor: '#F8FAFC', borderRadius: 12, marginVertical: 20,
  },
  validUntil:    { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  ratingSection: { marginTop: 32, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 24 },
  ratingTitle:   { fontSize: 16, fontWeight: '600', color: '#1E293B', marginBottom: 12 },
  starsRow:      { flexDirection: 'row', marginBottom: 16 },
  star:          { fontSize: 32, color: '#CBD5E1', marginRight: 8 },
  starActive:    { color: '#F59E0B' },
  commentInput:  {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    padding: 12, minHeight: 80, fontSize: 15, color: '#1E293B', marginBottom: 16,
  },
  submitBtn:     { backgroundColor: '#3B82F6', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  submitDisabled:{ opacity: 0.5 },
  submitText:    { color: '#fff', fontWeight: '600', fontSize: 16 },
  ratingThanks:  { fontSize: 16, color: '#10B981', fontWeight: '600', textAlign: 'center' },
})
```

- [ ] **Step 4: Run mobile tests**

```bash
npm test --workspace apps/mobile 2>&1 | tail -8
```

Expected: 91 tests pass (88 existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/__tests__/PrescriptionScreen.test.tsx apps/mobile/src/screens/patient/PrescriptionScreen.tsx
git commit -m "feat(mobile): PrescriptionScreen rating widget"
```

---

### Task 6: DoctorProfileScreen avg_rating + admin DoctorsTable rating column

**Files:**
- Modify: `apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx`
- Modify: `apps/admin/src/components/DoctorsTable.tsx`

#### Context

`DoctorProfileScreen` already fetches `/api/doctors/me`. The response now includes `avg_rating: number | null` and `rating_count: number`. Parse these into state and display below the availability row. The admin `DoctorsTable` approved tab renders a card per doctor — add a rating badge.

- [ ] **Step 1: Update DoctorProfileScreen**

Replace `apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx` with:

```typescript
import React, { useEffect, useState } from 'react'
import {
  View, Text, Switch, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'

export default function DoctorProfileScreen() {
  const { t } = useTranslation()
  const language    = useAuthStore((s) => s.language)
  const setLanguage = useAuthStore((s) => s.setLanguage)
  const logout      = useAuthStore((s) => s.logout)

  const [available,    setAvailable]    = useState(false)
  const [avgRating,    setAvgRating]    = useState<number | null>(null)
  const [ratingCount,  setRatingCount]  = useState(0)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    api.get<{ available: boolean; avg_rating: number | null; rating_count: number }>('/api/doctors/me')
      .then(({ data }) => {
        setAvailable(data.available)
        setAvgRating(data.avg_rating)
        setRatingCount(data.rating_count)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (value: boolean) => {
    const prev = available
    setAvailable(value)
    try {
      await api.put('/api/doctors/availability', { available: value })
    } catch {
      setAvailable(prev)
      Alert.alert(t('common.error_generic'))
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('profile.title')}</Text>

      {loading ? (
        <ActivityIndicator color="#3B82F6" style={styles.loader} />
      ) : (
        <>
          <View style={styles.row}>
            <Text style={styles.label}>{t('doctor.availability_label')}</Text>
            <Switch
              testID="availability-switch"
              value={available}
              onValueChange={handleToggle}
              trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
              thumbColor="#fff"
            />
          </View>

          {ratingCount > 0 && (
            <Text style={styles.ratingText} testID="avg-rating">
              {'★ '}
              {avgRating !== null ? avgRating.toFixed(1) : '—'}
              {` (${ratingCount} ${t('consultation.avg_rating')})`}
            </Text>
          )}
        </>
      )}

      <Text style={styles.sectionLabel}>{t('profile.language')}</Text>
      <View style={styles.langRow}>
        <TouchableOpacity
          onPress={() => setLanguage('es')}
          style={[styles.langBtn, language === 'es' && styles.langBtnActive]}
          testID="lang-es"
        >
          <Text style={language === 'es' ? styles.langTextActive : styles.langText}>ES</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setLanguage('en')}
          style={[styles.langBtn, language === 'en' && styles.langBtnActive]}
          testID="lang-en"
        >
          <Text style={language === 'en' ? styles.langTextActive : styles.langText}>EN</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={logout} style={styles.logoutBtn} testID="logout-btn">
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, padding: 24 },
  title:        { fontSize: 24, fontWeight: 'bold', marginBottom: 24 },
  loader:       { marginBottom: 24 },
  row:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label:        { fontSize: 16, color: '#1E293B' },
  ratingText:   { fontSize: 14, color: '#F59E0B', fontWeight: '600', marginBottom: 24 },
  sectionLabel: { fontSize: 16, marginBottom: 8 },
  langRow:      { flexDirection: 'row', gap: 8, marginBottom: 32 },
  langBtn: {
    paddingVertical: 8, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 6,
  },
  langBtnActive:  { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  langText:       { color: '#64748B', fontWeight: '500' },
  langTextActive: { color: '#3B82F6', fontWeight: '600' },
  logoutBtn: {
    marginTop: 'auto', padding: 14, backgroundColor: '#EF4444',
    borderRadius: 8, alignItems: 'center',
  },
  logoutText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 2: Update DoctorsTable**

In `apps/admin/src/components/DoctorsTable.tsx`, update the `Doctor` interface:

```typescript
interface Doctor {
  id: string; cedula: string | null; available: boolean
  approved_at: string | null; cmh_verified: boolean; user: DoctorUser
  avg_rating:   number | null
  rating_count: number
}
```

In the approved doctors tab, inside each doctor card (after the `<span>` with available/unavailable status), add:

```tsx
<span className="text-yellow-400 text-sm font-medium">
  {doc.avg_rating !== null
    ? `★ ${doc.avg_rating.toFixed(1)} (${doc.rating_count})`
    : '—'}
</span>
```

- [ ] **Step 3: Run mobile tests**

```bash
npm test --workspace apps/mobile 2>&1 | tail -8
```

Expected: 91 tests pass. The `DoctorProfileScreen.test.tsx` mocks `api.get` returning `{ available: false }` — the updated screen accesses `data.avg_rating` and `data.rating_count` which will be `undefined`, defaulting gracefully to no rating display. Existing 4 DoctorProfileScreen tests should still pass.

- [ ] **Step 4: Run API tests**

```bash
npm run test --workspace packages/api 2>&1 | tail -8
```

Expected: 141 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/doctor/DoctorProfileScreen.tsx apps/admin/src/components/DoctorsTable.tsx
git commit -m "feat(mobile,admin): show doctor avg rating on profile and admin panel"
```
