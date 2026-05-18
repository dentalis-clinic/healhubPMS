-- Fix schema drift: businessHours and slotDuration were added to the Clinic model
-- via `db push` after the initial multitenancy migration. Formalise them here so
-- the migration history matches the schema. IF NOT EXISTS makes this a no-op on
-- any DB where db push already ran.
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "businessHours" JSONB;
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "slotDuration" INTEGER;

-- Remove the DDCJ seed clinic and all its associated data.
-- The seed was inserted in migration 20260516 purely as a bootstrap row needed to
-- backfill clinicId onto existing tables before the NOT NULL constraint was added.
-- Now that Phase 3 onboarding (/register) is live, all clinics are created through
-- the wizard. Seed data has no place in a multi-tenant SaaS database.
-- This block is idempotent — safe to run even if DDCJ was already removed.
DO $$
DECLARE
    ddcj_id TEXT;
BEGIN
    SELECT "id" INTO ddcj_id FROM "clinics" WHERE "slug" = 'ddcj';

    IF ddcj_id IS NULL THEN
        RAISE NOTICE 'DDCJ clinic not found — nothing to remove.';
        RETURN;
    END IF;

    -- Delete in FK dependency order (children before parent).
    -- All FK constraints use ON DELETE RESTRICT, so order matters.
    DELETE FROM "prescriptions"        WHERE "clinicId" = ddcj_id;
    DELETE FROM "payments"             WHERE "clinicId" = ddcj_id;
    DELETE FROM "appointments"         WHERE "clinicId" = ddcj_id;
    DELETE FROM "patients"             WHERE "clinicId" = ddcj_id;
    DELETE FROM "printable_templates"  WHERE "clinicId" = ddcj_id;
    DELETE FROM "doctors"              WHERE "clinicId" = ddcj_id;
    DELETE FROM "admins"               WHERE "clinicId" = ddcj_id;
    DELETE FROM "clinics"              WHERE "id"       = ddcj_id;

    RAISE NOTICE 'DDCJ seed clinic and all associated data removed.';
END $$;
