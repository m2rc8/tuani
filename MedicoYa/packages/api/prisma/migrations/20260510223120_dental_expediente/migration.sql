-- DropIndex
DROP INDEX "Brigade_organizer_id_idx";

-- DropIndex
DROP INDEX "BrigadeDoctor_doctor_id_idx";

-- DropIndex
DROP INDEX "Consultation_brigade_id_idx";

-- DropIndex
DROP INDEX "Rating_doctor_id_idx";

-- DropIndex
DROP INDEX "Rating_patient_id_idx";

-- AlterTable
ALTER TABLE "DentalPatientFile" ALTER COLUMN "updated_at" DROP DEFAULT;
