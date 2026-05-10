ALTER TABLE "DentalRecord" ADD COLUMN "treatment_plan" TEXT;

ALTER TABLE "DentalTreatment" ADD COLUMN "started_at"        TIMESTAMP(3);
ALTER TABLE "DentalTreatment" ADD COLUMN "ended_at"          TIMESTAMP(3);
ALTER TABLE "DentalTreatment" ADD COLUMN "before_image_url"  TEXT;
ALTER TABLE "DentalTreatment" ADD COLUMN "after_image_url"   TEXT;
