-- CreateTable DentalPatientFile
CREATE TABLE "DentalPatientFile" (
  "id"         TEXT NOT NULL,
  "patient_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DentalPatientFile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DentalPatientFile_patient_id_key" ON "DentalPatientFile"("patient_id");
ALTER TABLE "DentalPatientFile"
  ADD CONSTRAINT "DentalPatientFile_patient_id_fkey"
  FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable DentalVisit
CREATE TABLE "DentalVisit" (
  "id"             TEXT NOT NULL,
  "file_id"        TEXT NOT NULL,
  "dentist_id"     TEXT NOT NULL,
  "brigade_id"     TEXT,
  "visit_date"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hygiene_notes"  TEXT,
  "cpod_index"     DECIMAL(4,2),
  "treatment_plan" TEXT,
  "referral_to"    TEXT,
  CONSTRAINT "DentalVisit_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "DentalVisit"
  ADD CONSTRAINT "DentalVisit_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "DentalPatientFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DentalVisit"
  ADD CONSTRAINT "DentalVisit_dentist_id_fkey"
  FOREIGN KEY ("dentist_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DentalVisit"
  ADD CONSTRAINT "DentalVisit_brigade_id_fkey"
  FOREIGN KEY ("brigade_id") REFERENCES "Brigade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate data: one DentalPatientFile per unique patient_id
INSERT INTO "DentalPatientFile" ("id", "patient_id", "created_at", "updated_at")
SELECT gen_random_uuid()::TEXT, patient_id, MIN(created_at), MIN(created_at)
FROM "DentalRecord"
GROUP BY patient_id;

-- Migrate data: convert each DentalRecord → DentalVisit (keep same id for FK reuse)
INSERT INTO "DentalVisit" ("id", "file_id", "dentist_id", "brigade_id", "visit_date",
                           "hygiene_notes", "cpod_index", "treatment_plan", "referral_to")
SELECT dr.id, dpf.id, dr.dentist_id, dr.brigade_id, dr.record_date,
       dr.hygiene_notes, dr.cpod_index, dr.treatment_plan, dr.referral_to
FROM "DentalRecord" dr
JOIN "DentalPatientFile" dpf ON dpf.patient_id = dr.patient_id;

-- Add file_id to ToothRecord (nullable first for migration)
ALTER TABLE "ToothRecord" ADD COLUMN "file_id" TEXT;

-- Assign file_id from most-recent DentalRecord per patient
UPDATE "ToothRecord" tr
SET "file_id" = dpf.id
FROM "DentalRecord" dr
JOIN "DentalPatientFile" dpf ON dpf.patient_id = dr.patient_id
WHERE tr.dental_record_id = dr.id
  AND dr.record_date = (
    SELECT MAX(dr2.record_date)
    FROM "DentalRecord" dr2
    WHERE dr2.patient_id = dr.patient_id
  );

-- Remove ToothRecord rows from non-latest records (file_id still NULL)
DELETE FROM "ToothRecord" WHERE "file_id" IS NULL;

-- Make file_id NOT NULL, swap unique constraint, add FK, drop old FK + column
ALTER TABLE "ToothRecord" ALTER COLUMN "file_id" SET NOT NULL;
ALTER TABLE "ToothRecord" DROP CONSTRAINT IF EXISTS "ToothRecord_dental_record_id_tooth_fdi_key";
ALTER TABLE "ToothRecord" ADD CONSTRAINT "ToothRecord_file_id_tooth_fdi_key" UNIQUE ("file_id", "tooth_fdi");
ALTER TABLE "ToothRecord"
  ADD CONSTRAINT "ToothRecord_file_id_fkey"
  FOREIGN KEY ("file_id") REFERENCES "DentalPatientFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ToothRecord" DROP CONSTRAINT IF EXISTS "ToothRecord_dental_record_id_fkey";
ALTER TABLE "ToothRecord" DROP COLUMN "dental_record_id";

-- Add visit_id to DentalTreatment, migrate (visit.id = record.id), make NOT NULL, swap FK
ALTER TABLE "DentalTreatment" ADD COLUMN "visit_id" TEXT;
UPDATE "DentalTreatment" SET "visit_id" = dental_record_id;
ALTER TABLE "DentalTreatment" ALTER COLUMN "visit_id" SET NOT NULL;
ALTER TABLE "DentalTreatment"
  ADD CONSTRAINT "DentalTreatment_visit_id_fkey"
  FOREIGN KEY ("visit_id") REFERENCES "DentalVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DentalTreatment" DROP CONSTRAINT IF EXISTS "DentalTreatment_dental_record_id_fkey";
ALTER TABLE "DentalTreatment" DROP COLUMN "dental_record_id";

-- Drop DentalRecord (all FK refs removed above)
DROP TABLE "DentalRecord";
