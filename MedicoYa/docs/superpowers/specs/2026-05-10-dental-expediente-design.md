# Dental Expediente Electrónico — Design Spec

**Date:** 2026-05-10  
**Status:** Approved

## Overview

Redesign the dental record system from a flat `DentalRecord` per visit to a proper electronic patient file (expediente electrónico). Each patient has one persistent `DentalPatientFile` with a cumulative odontogram, and each clinical encounter becomes a `DentalVisit` nested under that file.

## Motivation

Current system creates a new `DentalRecord` per encounter. Problems:
- No patient history view — doctor can't see prior visits before starting a new one
- Odontogram resets each visit — loses cumulative tooth state
- Treatments, hygiene notes, CPOD index have no historical context
- No way to distinguish "new patient" from "returning patient"

## Data Model

### New models

**DentalPatientFile** — one per patient, persists forever
```
id              uuid PK
patient_id      uuid UNIQUE FK → Patient
created_at      DateTime
updated_at      DateTime
─────────────────────────────
teeth[]         → ToothRecord  (cumulative odontogram)
visits[]        → DentalVisit
```

**DentalVisit** — replaces DentalRecord, one per clinical encounter
```
id              uuid PK
file_id         uuid FK → DentalPatientFile
dentist_id      uuid FK → User
brigade_id      uuid? FK → Brigade
visit_date      DateTime  default now()
hygiene_notes   String?
cpod_index      Decimal?
treatment_plan  String?
referral_to     String?
─────────────────────────────
treatments[]    → DentalTreatment
```

### Modified models

**ToothRecord** — `dental_record_id` → `file_id` (FK → DentalPatientFile)
- Unique constraint: `(file_id, tooth_fdi)`
- Single cumulative state per tooth, updated via upsert

**DentalTreatment** — `dental_record_id` → `visit_id` (FK → DentalVisit)
- All other fields unchanged (procedure, status, priority, materials, cost_lps, notes, started_at, ended_at, before_image_url, after_image_url)

### Dropped

`DentalRecord` table — dropped after migration.

## Migration Plan

Run in order inside a single transaction:

1. For each unique `patient_id` in `DentalRecord` → `INSERT INTO DentalPatientFile`
2. For each patient's most recent `DentalRecord` → copy its `ToothRecord` rows to the new `DentalPatientFile` (update `file_id`, drop `dental_record_id`)
3. Convert each `DentalRecord` → `DentalVisit` with correct `file_id`
4. Reassign every `DentalTreatment.dental_record_id` → `visit_id`
5. Drop `DentalRecord` table

## API

### Expediente

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dental/files` | Create file. Body: `{ patient_id }` |
| GET | `/api/dental/files/by-patient/:patientId` | Look up file by patient. 404 if none |
| GET | `/api/dental/files/:fileId` | Full file: teeth[] + visits[] with treatments[] |

### Odontogram

| Method | Path | Description |
|--------|------|-------------|
| PUT | `/api/dental/files/:fileId/teeth/:toothFdi` | Upsert tooth state. Body: surfaces + notes |

### Visits

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dental/files/:fileId/visits` | Create visit. Body: `{ dentist_id, brigade_id? }` |
| GET | `/api/dental/visits/:visitId` | Visit with treatments[] |
| PATCH | `/api/dental/visits/:visitId` | Update hygiene_notes, cpod_index, treatment_plan, referral_to |
| GET | `/api/dental/dentist/:dentistId/visits` | All visits by dentist (for HistoryScreen tab) |

### Treatments (path changes only)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dental/visits/:visitId/treatments` | Add treatment |
| PATCH | `/api/dental/visits/:visitId/treatments/:treatmentId` | Update treatment |
| POST | `/api/dental/visits/:visitId/treatments/:treatmentId/images` | Upload before/after image |

### Removed endpoints

- `POST /api/dental/records`
- `GET /api/dental/records/:id`
- `PATCH /api/dental/records/:id/treatment-plan`
- `POST /api/dental/records/:id/treatments/:tid/images`

## UI / Navigation

### Mobile

**DentalPickerScreen** (modified)
- Search adult by phone or minor by name
- If `DentalPatientFile` exists → navigate to `DentalExpedienteScreen`
- If not → create file → navigate to `DentalExpedienteScreen`
- Does NOT create a visit on picker

**DentalExpedienteScreen** (new)
- Shows cumulative odontogram (current tooth states)
- Lists prior visits: date, dentist name, treatment count
- "Nueva Visita" button → creates `DentalVisit` → navigates to `DentalRecordScreen`

**DentalRecordScreen** (modified)
- Now represents a `DentalVisit`, not a `DentalRecord`
- Fields: hygiene notes, CPOD index, treatment plan, referral, treatments with photos/dates
- Back button → returns to `DentalExpedienteScreen`

**HistoryScreen (dental tab)**
- Fetches dentist's visits via `GET /api/dental/dentist/:id/visits`
- Tap → opens `DentalExpedienteScreen` (not the visit directly) so doctor sees full patient history

### Admin web

**`/doctor/dental`** (modified picker — same logic as mobile)

**`/doctor/dental/patients/[fileId]`** (new)
- Cumulative odontogram
- Visit history table: date, dentist, brigade
- "Nueva Visita" button

**`/doctor/dental/visits/[visitId]`** (replaces `/doctor/dental/[recordId]`)
- Edit odontogram (upserts to file's ToothRecord)
- hygiene notes, CPOD, treatment plan, referral
- Treatments with before/after images

## Key Behaviors

- **Odontogram is cumulative.** `PUT /teeth/:fdi` upserts `ToothRecord` by `(file_id, tooth_fdi)`. Editing tooth state in any visit modifies the same record — there is no per-visit snapshot.
- **Visits are immutable once created** (date, dentist, brigade). Fields like notes/plan are editable.
- **Picker never creates a visit** — it only resolves or creates the file. Doctors tap "Nueva Visita" explicitly.
- **No data loss on migration** — all existing DentalRecord data is preserved as DentalVisit rows.

## Out of Scope

- Tooth state history / audit log (who changed what tooth and when)
- Multi-dentist concurrent editing
- PDF export of expediente
