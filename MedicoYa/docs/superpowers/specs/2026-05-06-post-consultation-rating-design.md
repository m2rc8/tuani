# Post-Consultation Rating — Design Spec

**Date:** 2026-05-06
**Project:** MédicoYa
**Scope:** Phase 2 — patient rates doctor (1–5 stars + optional comment) after consultation completes.

---

## 1. Decisions

| Question | Decision |
|----------|----------|
| Who rates | Patient rates the doctor |
| Scale | 1–5 stars |
| Comment | Optional free-text, max 300 chars |
| Trigger | On PrescriptionScreen, below prescription content |
| Re-rating | Not allowed — unique constraint on `consultation_id` |
| Visibility | Admin panel (approved doctors tab) + doctor's own average on DoctorProfileScreen |
| Star UI | Plain `TouchableOpacity` row, no external library |

---

## 2. Architecture

### Files changed

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

## 3. Data Model

### `Rating` model (add to `schema.prisma`)

```prisma
model Rating {
  id              String   @id @default(uuid())
  consultation_id String   @unique
  doctor_id       String
  patient_id      String
  stars           Int
  comment         String?
  created_at      DateTime @default(now())

  consultation Consultation @relation(fields: [consultation_id], references: [id])
  doctor       Doctor       @relation(fields: [doctor_id], references: [id])
  patient      Patient      @relation(fields: [patient_id], references: [id])
}
```

Add back-relations:
```prisma
// On Consultation:
rating Rating?

// On Doctor:
ratings Rating[]

// On Patient:
ratings Rating[]
```

### Migration SQL

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
CREATE INDEX "Rating_doctor_id_idx" ON "Rating"("doctor_id");
CREATE INDEX "Rating_patient_id_idx" ON "Rating"("patient_id");
```

---

## 4. API

### POST /api/ratings

File: `packages/api/src/routes/ratings.ts`

- `requireAuth` + `requireRole(Role.patient)`
- Body validated with zod:
  ```typescript
  z.object({
    consultation_id: z.string().uuid(),
    stars:           z.number().int().min(1).max(5),
    comment:         z.string().max(300).optional(),
  })
  ```
- Guards (in order):
  1. Fetch consultation — 404 if not found
  2. `consultation.patient_id !== req.user.sub` → 403
  3. `consultation.status !== 'completed'` → 409 `{ error: 'Consultation not completed' }`
  4. `consultation.doctor_id` must not be null (completed consultations always have doctor_id — but guard defensively → 409)
- Create rating:
  ```typescript
  await db.rating.create({
    data: {
      id:              randomUUID(),
      consultation_id: body.consultation_id,
      doctor_id:       consultation.doctor_id!,
      patient_id:      req.user!.sub,
      stars:           body.stars,
      comment:         body.comment,
    },
  })
  ```
- Duplicate submission: Prisma unique constraint violation (`P2002`) → catch and return 409 `{ error: 'Already rated' }`
- Returns `201`

### Tests (8 cases)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | No auth | 401 |
| 2 | Doctor role | 403 |
| 3 | Invalid stars (0 or 6) | 400 |
| 4 | Consultation not found | 404 |
| 5 | Patient not owner | 403 |
| 6 | Consultation not completed | 409 |
| 7 | Success (stars + comment) | 201 |
| 8 | Duplicate submission | 409 |

### GET /api/consultations/:id — enrich with rating

Update `ConsultationService.getConsultation()` to include rating:

```typescript
const c = await this.db.consultation.findUnique({
  where:   { id },
  include: { prescription: true, rating: true },
})
```

Response now includes `rating: { id, stars, comment, created_at } | null`.

### GET /api/doctors/me — add avg_rating

Update handler in `packages/api/src/routes/doctors.ts`:

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
  avg_rating:   ratingAgg._avg.stars,    // number | null
  rating_count: ratingAgg._count.stars,  // number
})
```

### GET /api/admin/doctors/approved — add avg_rating

Update handler in `packages/api/src/routes/admin.ts` to enrich each doctor with avg_rating. After fetching doctors, batch-fetch all ratings in one query:

```typescript
const doctors = await db.doctor.findMany({
  where:   { approved_at: { not: null }, rejected_at: null },
  include: { user: { select: { name: true, phone: true } } },
})

const ratings = await db.rating.groupBy({
  by:    ['doctor_id'],
  _avg:  { stars: true },
  _count: { stars: true },
})

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

---

## 5. Mobile

### i18n keys

**`es.json`** — inside `"consultation"` block:
```json
"rate_title":      "Califica tu consulta",
"rate_submit":     "Enviar calificación",
"rate_thanks":     "¡Gracias por tu calificación!",
"rate_comment":    "Comentario (opcional)",
"avg_rating":      "Calificación promedio"
```

**`en.json`** — inside `"consultation"` block:
```json
"rate_title":      "Rate your consultation",
"rate_submit":     "Submit rating",
"rate_thanks":     "Thanks for your rating!",
"rate_comment":    "Comment (optional)",
"avg_rating":      "Average rating"
```

### `apps/mobile/src/lib/types.ts` changes

Add `Rating` interface and extend `ConsultationDetail`:

```typescript
export interface Rating {
  id:         string
  stars:      number
  comment:    string | null
  created_at: string
}

// In ConsultationDetail:
rating: Rating | null
```

### `PrescriptionScreen.tsx`

Below the QR code and `valid_until`, render:

**If `detail.rating` is null** (unrated): star picker widget
- State: `selectedStars: number` (0 = none selected), `comment: string`, `submitting: boolean`, `submitted: boolean`
- 5 `TouchableOpacity` stars, filled gold (★) if `i <= selectedStars`, gray (☆) otherwise
- `testID="star-{i}"` on each star
- Optional `TextInput` for comment (`testID="rating-comment"`)
- `TouchableOpacity` submit button (`testID="rating-submit"`) — disabled if `selectedStars === 0` or `submitting`
- On submit: `POST /api/ratings { consultation_id, stars: selectedStars, comment }` → on success set `submitted = true`

**If `detail.rating !== null` OR `submitted === true`**: show submitted rating read-only
- Display `★★★★☆` filled according to stars
- Display comment if present
- Display `t('consultation.rate_thanks')`

### `DoctorProfileScreen.tsx`

After fetching `GET /api/doctors/me`, the response now includes `avg_rating` and `rating_count`. Below the availability Switch, add:

```typescript
{ratingCount > 0 && (
  <Text style={styles.rating}>★ {avgRating?.toFixed(1)} ({ratingCount} {t('consultation.avg_rating')})</Text>
)}
```

State: `avgRating: number | null`, `ratingCount: number` — set from the `/me` response.

---

## 6. Admin Panel

### `DoctorsTable.tsx`

Update `Doctor` interface:
```typescript
interface Doctor {
  // ... existing ...
  avg_rating:   number | null
  rating_count: number
}
```

In the approved doctors tab, add a rating column to each card:
```tsx
<span className="text-yellow-400 text-sm">
  {doc.avg_rating !== null
    ? `★ ${doc.avg_rating.toFixed(1)} (${doc.rating_count})`
    : '—'}
</span>
```

---

## 7. PrescriptionScreen Tests

File: `apps/mobile/src/__tests__/PrescriptionScreen.test.tsx`

Mock: `api.get` (GET /api/consultations/:id), `api.post` (POST /api/ratings), `react-i18next`, `expo-secure-store`, `@react-native-async-storage/async-storage`, `react-qr-code`.

| # | Test | Setup | Assert |
|---|------|-------|--------|
| 1 | Shows star picker when unrated | `api.get` resolves with `rating: null` | `testID="star-1"` visible, `testID="rating-submit"` visible |
| 2 | Submits rating successfully | Tap star 4, tap submit; `api.post` resolves | `api.post` called with `{ stars: 4, ... }`; thanks message visible |
| 3 | Shows read-only stars when already rated | `api.get` resolves with `rating: { stars: 3, comment: null, ... }` | `testID="rating-submit"` not present; thanks message visible |

---

## 8. Out of Scope

- Rating moderation or deletion
- Editing a submitted rating
- Displaying doctor rating to patients before accepting a consultation
- Sorting consultation queue by doctor rating
- Rating breakdown (per-star counts)
