-- CreateTable
CREATE TABLE "Rating" (
    "id"              TEXT NOT NULL,
    "consultation_id" TEXT NOT NULL,
    "doctor_id"       TEXT NOT NULL,
    "patient_id"      TEXT NOT NULL,
    "stars"           INTEGER NOT NULL,
    "comment"         TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "stars_check" CHECK ("stars" >= 1 AND "stars" <= 5)
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_consultation_id_key" ON "Rating"("consultation_id");

-- CreateIndex
CREATE INDEX "Rating_doctor_id_idx" ON "Rating"("doctor_id");

-- CreateIndex
CREATE INDEX "Rating_patient_id_idx" ON "Rating"("patient_id");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_consultation_id_fkey" FOREIGN KEY ("consultation_id") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
