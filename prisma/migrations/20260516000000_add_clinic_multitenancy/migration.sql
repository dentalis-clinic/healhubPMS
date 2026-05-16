-- CreateTable: clinics must exist before we can reference it
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "address" JSONB,
    "phones" TEXT[],
    "email" TEXT,
    "website" TEXT,
    "logo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinics_slug_key" ON "clinics"("slug");

-- Seed the founding DDCJ clinic so we can backfill existing rows
INSERT INTO "clinics" (
    "id", "slug", "name", "shortName", "timezone",
    "address", "phones", "email", "website", "isActive",
    "createdAt", "updatedAt"
)
VALUES (
    gen_random_uuid()::TEXT,
    'ddcj',
    'Dentalis Dental Care by Jamians',
    'DDCJ',
    'Asia/Kolkata',
    '{"line1":"D2/2A, Thokar No - 8, Classic Appartment","line2":"Tayyab Masjid Road, Shaheen Bagh","city":"New Delhi","state":"Delhi","pincode":"110025"}'::JSONB,
    ARRAY['+91-8700510032', '+91-7838344590', '011-45656948'],
    'dentalis.delhi@gmail.com',
    'www.dentalis.co.in',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

-- Add clinicId as nullable first so existing rows can be backfilled
ALTER TABLE "admins" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "appointments" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "doctors" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "patients" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "payments" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "prescriptions" ADD COLUMN "clinicId" TEXT;
ALTER TABLE "printable_templates" ADD COLUMN "clinicId" TEXT;

-- Backfill all existing rows to the DDCJ clinic
DO $$
DECLARE
    ddcj_id TEXT;
BEGIN
    SELECT "id" INTO ddcj_id FROM "clinics" WHERE "slug" = 'ddcj';

    UPDATE "admins" SET "clinicId" = ddcj_id WHERE "clinicId" IS NULL;
    UPDATE "appointments" SET "clinicId" = ddcj_id WHERE "clinicId" IS NULL;
    UPDATE "doctors" SET "clinicId" = ddcj_id WHERE "clinicId" IS NULL;
    UPDATE "patients" SET "clinicId" = ddcj_id WHERE "clinicId" IS NULL;
    UPDATE "payments" SET "clinicId" = ddcj_id WHERE "clinicId" IS NULL;
    UPDATE "prescriptions" SET "clinicId" = ddcj_id WHERE "clinicId" IS NULL;
    UPDATE "printable_templates" SET "clinicId" = ddcj_id WHERE "clinicId" IS NULL;
END $$;

-- Now enforce NOT NULL
ALTER TABLE "admins" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "doctors" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "patients" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "prescriptions" ALTER COLUMN "clinicId" SET NOT NULL;
ALTER TABLE "printable_templates" ALTER COLUMN "clinicId" SET NOT NULL;

-- Add FK constraints
ALTER TABLE "patients" ADD CONSTRAINT "patients_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "printable_templates" ADD CONSTRAINT "printable_templates_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "admins" ADD CONSTRAINT "admins_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "admins_clinicId_idx" ON "admins"("clinicId");
CREATE INDEX "appointments_clinicId_idx" ON "appointments"("clinicId");
CREATE INDEX "doctors_clinicId_idx" ON "doctors"("clinicId");
CREATE INDEX "patients_clinicId_idx" ON "patients"("clinicId");
CREATE INDEX "payments_clinicId_idx" ON "payments"("clinicId");
CREATE INDEX "prescriptions_clinicId_idx" ON "prescriptions"("clinicId");
CREATE INDEX "printable_templates_clinicId_idx" ON "printable_templates"("clinicId");
