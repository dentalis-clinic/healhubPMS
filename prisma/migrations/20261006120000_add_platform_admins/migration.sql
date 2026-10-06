-- Super admin ("platform admin") support. Platform admins manage clinics and
-- clinic admin accounts across tenants; they never read patient data.
-- Kept in their own table (not a flag on admins) so every clinic-scoped code
-- path that reads admins stays untouched. Accounts are created only by
-- scripts/seed-platform-admin.ts — there is no web UI path to become one.

-- ---------------------------------------------------------------------------
-- platform_admins — id is the Supabase auth.users id (shared UUID), like admins.
-- ---------------------------------------------------------------------------
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- Server (service_role) access only. RLS on with no policies blocks the
-- PostgREST anon/authenticated roles even if a grant slips through later.
ALTER TABLE "platform_admins" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "platform_admins" FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE "platform_admins" TO service_role;

-- ---------------------------------------------------------------------------
-- get_platform_clinic_overview — one row per clinic with account and usage
-- counts for the super admin panel. Counts only; no patient fields leave the
-- database. Set-returning, so callers order/filter through PostgREST.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_platform_clinic_overview()
RETURNS TABLE (
  id text,
  slug text,
  name text,
  "shortName" text,
  email text,
  phones text[],
  "isActive" boolean,
  "createdAt" timestamp,
  "adminCount" integer,
  "patientCount" integer,
  "appointmentCount" integer,
  "lastAppointmentAt" timestamp
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    c.id, c.slug, c.name, c."shortName", c.email, c.phones, c."isActive", c."createdAt",
    (SELECT count(*)::integer FROM admins ad WHERE ad."clinicId" = c.id),
    (SELECT count(*)::integer FROM patients p WHERE p."clinicId" = c.id),
    (SELECT count(*)::integer FROM appointments a WHERE a."clinicId" = c.id),
    (SELECT max(a."createdAt") FROM appointments a WHERE a."clinicId" = c.id)
  FROM clinics c
$$;

-- Privileges. Supabase's default privileges grant EXECUTE on new public
-- functions directly to anon/authenticated, so revoke from them explicitly.
REVOKE ALL ON FUNCTION get_platform_clinic_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_platform_clinic_overview() TO service_role;
