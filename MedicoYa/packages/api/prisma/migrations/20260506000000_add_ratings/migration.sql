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
