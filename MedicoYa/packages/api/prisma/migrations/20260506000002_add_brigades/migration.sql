-- Add coordinator to Role enum
ALTER TYPE "Role" ADD VALUE 'coordinator';

-- New enums
CREATE TYPE "ConsultationMode" AS ENUM ('telemedicine', 'brigade');
CREATE TYPE "BrigadeStatus"    AS ENUM ('active', 'closed');

-- Brigade table
CREATE TABLE "Brigade" (
  "id"           TEXT            NOT NULL,
  "name"         TEXT            NOT NULL,
  "organizer_id" TEXT            NOT NULL,
  "community"    TEXT            NOT NULL,
  "municipality" TEXT,
  "department"   TEXT,
  "start_date"   TIMESTAMP(3)    NOT NULL,
  "end_date"     TIMESTAMP(3)    NOT NULL,
  "join_code"    TEXT            NOT NULL,
  "status"       "BrigadeStatus" NOT NULL DEFAULT 'active',
  "created_at"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Brigade_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Brigade_join_code_key" ON "Brigade"("join_code");
CREATE INDEX "Brigade_organizer_id_idx" ON "Brigade"("organizer_id");

ALTER TABLE "Brigade"
  ADD CONSTRAINT "Brigade_organizer_id_fkey"
  FOREIGN KEY ("organizer_id") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- BrigadeDoctor join table
CREATE TABLE "BrigadeDoctor" (
  "brigade_id" TEXT         NOT NULL,
  "doctor_id"  TEXT         NOT NULL,
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BrigadeDoctor_pkey" PRIMARY KEY ("brigade_id", "doctor_id")
);

CREATE INDEX "BrigadeDoctor_doctor_id_idx" ON "BrigadeDoctor"("doctor_id");

ALTER TABLE "BrigadeDoctor"
  ADD CONSTRAINT "BrigadeDoctor_brigade_id_fkey"
  FOREIGN KEY ("brigade_id") REFERENCES "Brigade"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrigadeDoctor"
  ADD CONSTRAINT "BrigadeDoctor_doctor_id_fkey"
  FOREIGN KEY ("doctor_id") REFERENCES "Doctor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Extend Consultation
ALTER TABLE "Consultation"
  ADD COLUMN "mode"       "ConsultationMode" NOT NULL DEFAULT 'telemedicine',
  ADD COLUMN "brigade_id" TEXT,
  ADD COLUMN "local_id"   TEXT,
  ADD COLUMN "synced_at"  TIMESTAMP(3);

CREATE INDEX "Consultation_brigade_id_idx" ON "Consultation"("brigade_id");

ALTER TABLE "Consultation"
  ADD CONSTRAINT "Consultation_brigade_id_fkey"
  FOREIGN KEY ("brigade_id") REFERENCES "Brigade"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
