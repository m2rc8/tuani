-- CreateTable
CREATE TABLE "DentalRecord" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "dentist_id" TEXT NOT NULL,
    "brigade_id" TEXT,
    "record_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cpod_index" DECIMAL(4,2),
    "hygiene_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DentalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothRecord" (
    "id" TEXT NOT NULL,
    "dental_record_id" TEXT NOT NULL,
    "tooth_fdi" INTEGER NOT NULL,
    "surface_mesial" TEXT NOT NULL DEFAULT 'healthy',
    "surface_distal" TEXT NOT NULL DEFAULT 'healthy',
    "surface_occlusal" TEXT NOT NULL DEFAULT 'healthy',
    "surface_vestibular" TEXT NOT NULL DEFAULT 'healthy',
    "surface_palatal" TEXT NOT NULL DEFAULT 'healthy',
    "notes" TEXT,

    CONSTRAINT "ToothRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DentalTreatment" (
    "id" TEXT NOT NULL,
    "dental_record_id" TEXT NOT NULL,
    "tooth_fdi" INTEGER,
    "procedure" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "priority" TEXT NOT NULL DEFAULT 'elective',
    "cost_lps" DECIMAL(10,2),
    "notes" TEXT,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DentalTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ToothRecord_dental_record_id_tooth_fdi_key" ON "ToothRecord"("dental_record_id", "tooth_fdi");

-- AddForeignKey
ALTER TABLE "DentalRecord" ADD CONSTRAINT "DentalRecord_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DentalRecord" ADD CONSTRAINT "DentalRecord_dentist_id_fkey" FOREIGN KEY ("dentist_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DentalRecord" ADD CONSTRAINT "DentalRecord_brigade_id_fkey" FOREIGN KEY ("brigade_id") REFERENCES "Brigade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothRecord" ADD CONSTRAINT "ToothRecord_dental_record_id_fkey" FOREIGN KEY ("dental_record_id") REFERENCES "DentalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DentalTreatment" ADD CONSTRAINT "DentalTreatment_dental_record_id_fkey" FOREIGN KEY ("dental_record_id") REFERENCES "DentalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
