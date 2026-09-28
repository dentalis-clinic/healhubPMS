# Rollout Batch 1: typegen + `require-admin.ts` + the 3 shared transactional helpers

> **Status: ✅ DONE (2026-09-27).** All 5 steps implemented and verified. The SQL/snippets below are the *original plan* — the shipped versions differ in several places (see "What actually shipped"). Next up: Batch 2.

## What actually shipped (deviations from the plan below)

**Step 1 — typegen.** `src/generated/supabase/database.types.ts` is **committed, not gitignored**: unlike Prisma's client it can't be rebuilt without DB access, so a clean checkout / CI build would fail. `npm run db:types` runs `scripts/gen-db-types.ts` (loads `.env`, strips CLI log lines from stdout, formats with oxfmt) — the plan's inline npm script wouldn't work (`$DIRECT_URL` isn't loaded by npm). `createAdminClient()` is now `createClient<Database>`.

**Step 2 — `require-admin.ts`.** Uses `.maybeSingle()` (0 rows → 403; real DB errors throw → caller's 500). `Admin`/`Clinic` types derived from generated `Tables<>`; timestamps are now ISO strings (no caller read them). Verified live: `clinic` embed is an object.

**Step 3 — migrations** (both applied to the live SaaS DB with user approval):
- `20260926120000_add_appointment_patient_prescription_rpc` — the 4 RPCs, but rewritten vs the plan's draft SQL:
  - **`MAX(serial)+1`, not `COUNT+1`** — COUNT re-issues an existing ID after a same-day delete (bulk-delete exists); only the old retry loop hid this.
  - **`patients.patientId` / `prescriptions.prescriptionId` changed from global `@unique` → `@@unique([clinicId, …])`** (schema.prisma updated). They were generated per clinic but unique globally → two clinics' first RX of the day collided. `prescriptions/[id]` GET updated to the compound key.
  - `update_appointment_atomic` uses `p_data ? 'key'` (present key, even null, sets the column) instead of COALESCE (which could never clear doctorId/notes/etc.), is **clinic-scoped** (plan's draft wasn't), raises `NOT_FOUND`, and reads `preferredDateTime` from `p_data` (no separate param).
  - `find_or_create_patient` takes the advisory lock **before** the lookup (closes a duplicate-patient race the Prisma version had); returns `{id, patientId, isNew}`.
  - `create_prescription_with_id` scopes its appointment UPDATE by clinic.
  - Inputs cast via `::timestamptz AT TIME ZONE 'UTC'`; shared `_next_daily_serial_id()` helper.
  - **Security:** `REVOKE … FROM PUBLIC, anon, authenticated` on all 7 functions, including Phase 3's two. Supabase default privileges had granted `anon` EXECUTE on them; not exploitable (SECURITY INVOKER + RLS enabled with no policies → anon sees 0 rows — verified), but closed. Now anon → HTTP 401.
- `20260927090000_promote_prescription_appointment_unique_to_constraint` — found during Step 4: PostgREST only infers 1:1 from a unique *constraint*, Prisma creates an *index* → `prescription:prescriptions(...)` embed returned `[]` (truthy), which would have made the prescriptions POST reject every request. Promoted via `ADD CONSTRAINT … UNIQUE USING INDEX` (metadata-only). `prisma migrate diff` DB→schema is now an **empty migration** (no drift at all).

**Step 4 — routes.** New shared modules: `src/lib/supabase/rpc.ts` (typed `p_data` payloads from `TablesInsert`/`TablesUpdate`, `SLOT_CONFLICT`/`NOT_FOUND`/`23505` mapping, identical 409 body) and `src/lib/supabase/serialize.ts` (`utcIso`, `withUtcTimestamps`, `dateOnlyIso` — PostgREST returns `timestamp` columns without a zone). All 4 routes are fully Prisma-free. Duplicate-booking check uses `patients!inner` + JS case-insensitive name compare (ilike would treat `% _ *` as wildcards). `totalAmount` is now a number (Prisma Decimal serialized as string; `src/types/patient.ts` already declared `number`). **Helpers NOT deleted**: `appointments/confirm` (Batch 2) still imports `findOrCreatePatient`, `generateAppointmentId`, `checkSlotConflict`.

**Step 5 — `dashboard.ts`.** `fetchDashboardStats` → `get_dashboard_stats` RPC; `fetchAppointments` → one query with `{ count: "exact" }` + `.range()`.

**Out-of-scope fix found during E2E:** `middleware.ts` copied all incoming headers and never stripped client-supplied `x-clinic-id/-timezone/-short-name` → on a host with no resolved clinic, a client could pick any clinic (bypasses `isActive`; forged prefix/timezone). Now deleted up front. Verified on a production build (spoofed headers on root domain → 503).

### Verification performed
- Migration dry-run in `BEGIN…ROLLBACK` on the live DB: 27/27 checks.
- Live supabase-js RPC + parity suite (19/19): all RPC paths/errors via PostgREST, anon → 401, and **old Prisma `dashboard.ts` vs new** deep-equal JSON on realistic fixtures (today/upcoming/cancelled, doctor, decimal payments + WAIVED, prescription). Fixtures cleaned up.
- E2E through the real route (dev server): new booking 201 (`preferredDateTime` round-trips with `Z`), duplicate 409, slot conflict 409 `SLOT_CONFLICT`. Rows cleaned up.
- `tsc --noEmit` clean; `npm run lint` 0 errors (touched files: 0 new warnings); `npm run build` ✅; `npx opennextjs-cloudflare build` ✅ with `pg-cloudflare/dist/index.js` present.
- ~~Not verified end-to-end: the 3 admin-authenticated routes~~ — closed 2026-09-28 by the authenticated HTTP E2E suite run during Batch 2a (see progress doc).

---

## Context

Following Phase 3 (2 prototype routes converted from Prisma to `@supabase/supabase-js`), this continues the rollout across the remaining 39 files. Given the scope, this is being tackled in batches rather than all at once — this plan covers **Batch 1 only**: the highest-leverage, most structurally important pieces. Later batches (scoped at the end of this doc, not implemented here) cover the remaining ~30 simple CRUD files and 3 more transactional route files.

A full categorization of all 39 files (via prior investigation) found:
- **31 files**: simple CRUD (`findMany`/`findUnique`/`create`/`update`/`delete`) — map directly to supabase-js's query builder, no RPC needed.
- **16 files** (overlapping with the above): rely on Prisma's relational `include`/nested `select` — need PostgREST's embedded-resource `.select('*, table(*)')` syntax, which has its own FK-disambiguation nuances to verify per-file in later batches.
- **7 files**: depend on transactional logic — 3 directly (`appointments/confirm`, `patients/[id]` DELETE, `patients` DELETE), and **4 more transitively**, through three shared helper modules (`src/lib/utils/slot-conflict.ts`, `patient-id.ts`, `prescription-id.ts`) that wrap `prisma.$transaction` with Serializable isolation + retry-on-conflict.
- **1 file** (`src/lib/data/dashboard.ts`): duplicates the already-converted `dashboard/stats` route's raw-SQL query — trivially reusable, no new RPC needed.
- **`require-admin.ts`**: the single most-imported file among the 39 (called by ~25 routes) — converting it first de-risks everything downstream that depends on its `admin`/`clinic` shape.

**Why Batch 1 = these specific pieces, not simple CRUD first:** converting the 3 shared helpers unblocks 4 route files at once (rather than 4 bespoke conversions), and `require-admin.ts` is a dependency for nearly every other file in the rollout. Doing the hard, foundational work first means every subsequent batch is strictly easier and follows an established pattern.

## Verified facts

- No RLS exists on any table — tenant isolation is 100% app-layer `clinicId` filtering (confirmed in Phase 3). This batch continues using `createAdminClient()` (service-role key), matching the precedent already set.
- `id` columns have **no DB-level default** (`"id" TEXT NOT NULL`, no `DEFAULT`) — Prisma generates UUIDs client-side today. New RPC functions must generate them explicitly via `gen_random_uuid()::text` (confirmed available — already used in a prior migration).
- `getClinicDate(timezone)` = `DateTime.now().setZone(timezone).toFormat("yyyyMMdd")` → Postgres equivalent: `to_char(now() AT TIME ZONE p_timezone, 'YYYYMMDD')`.
- The Supabase CLI is not installed, but isn't needed as a devDependency: `npx supabase@latest gen types typescript --db-url "$DIRECT_URL" --schema public` works standalone (verified by actually running `--help` against the live current CLI, v2.118.0) — no `supabase login`/`link` required.
- `require-admin.ts`'s current Prisma call: `prisma.admin.findUnique({ where: { id: user.id }, include: { clinic: { select: { id: true, shortName: true, timezone: true } } } })`.

## Implementation

### Step 1 — Set up typegen

```bash
npx supabase@latest gen types typescript --db-url "$DIRECT_URL" --schema public > src/generated/supabase/database.types.ts
```
Add `/src/generated/supabase` to `.gitignore` (matches the existing `/src/generated/prisma` precedent — regenerated, not committed) and add an npm script:
```json
"db:types": "supabase gen types typescript --db-url \"$DIRECT_URL\" --schema public > src/generated/supabase/database.types.ts"
```
Import the generated `Database` type in `src/lib/supabase/admin.ts` and type `createClient<Database>(...)` so every `.from()`/`.rpc()` call downstream gets real type inference instead of hand-written casts (the `ApiJson`-style manual casts from Phase 3 were a stopgap for 2 calls; not proportionate for the scale of this rollout).

### Step 2 — Convert `src/lib/auth/require-admin.ts`

Replace the Prisma call with:
```ts
const supabase = createAdminClient();
const { data: admin, error } = await supabase
  .from("admins")
  .select("id, clinicId, email, name, createdAt, updatedAt, clinic:clinics(id, shortName, timezone)")
  .eq("id", user.id)
  .single();
```
`clinic:clinics(...)` is PostgREST's embedded-resource syntax (alias `clinic`, joining the `clinics` table via the `clinicId` FK) — returns a nested object matching the existing `Clinic` shape this file already returns. No behavior change for callers.

### Step 3 — Three RPC functions replacing the shared transactional helpers

All three use the same pattern: **a `pg_advisory_xact_lock(hashtext(p_clinic_id))` scoped to the clinic**, replacing Prisma's Serializable-isolation + retry-on-unique-violation loop. This is a genuine improvement, not just a port — the lock serializes concurrent writes *for that one clinic only* (different clinics never block each other), and eliminates the retry loop entirely since the race is prevented rather than detected-and-retried.

**Migration file**: new `prisma/migrations/<timestamp>_add_appointment_patient_prescription_rpc/migration.sql`, applied via `prisma migrate deploy` (same process as Phase 3 — `migrate dev` will hit the same shadow-DB replay issue from the known schema drift; use hand-created migration folder + `deploy` instead).

```sql
-- create_appointment_atomic: replaces createAppointmentAtomic (slot-conflict.ts).
-- Slot-conflict check + sequential ID generation + insert, serialized per-clinic.
CREATE OR REPLACE FUNCTION create_appointment_atomic(
  p_clinic_id text,
  p_timezone text,
  p_allow_override boolean,
  p_data jsonb
)
RETURNS appointments
LANGUAGE plpgsql
AS $$
DECLARE
  v_preferred_datetime timestamp;
  v_conflict_count integer;
  v_today_date text;
  v_today_count integer;
  v_appointment_id text;
  v_result appointments;
BEGIN
  v_preferred_datetime := (p_data->>'preferredDateTime')::timestamp;

  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  IF NOT p_allow_override THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM appointments
    WHERE "clinicId" = p_clinic_id
      AND "preferredDateTime" = v_preferred_datetime
      AND status IN ('PENDING', 'OVERDUE', 'CONFIRMED', 'COMPLETED');
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'SLOT_CONFLICT';
    END IF;
  END IF;

  v_today_date := to_char(now() AT TIME ZONE p_timezone, 'YYYYMMDD');
  SELECT COUNT(*) INTO v_today_count
  FROM appointments
  WHERE "clinicId" = p_clinic_id AND "appointmentId" LIKE ('APT-' || v_today_date || '-%');
  v_appointment_id := 'APT-' || v_today_date || '-' || lpad((v_today_count + 1)::text, 4, '0');

  INSERT INTO appointments (
    id, "clinicId", "appointmentId", "patientId", "bookingChannel", "visitType",
    priority, type, status, "preferredDateTime", "reasonForVisit", "submittedBy",
    "adminUserId", "doctorId", notes, "totalAmount", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, p_clinic_id, v_appointment_id,
    p_data->>'patientId',
    (p_data->>'bookingChannel')::"BookingChannel",
    (p_data->>'visitType')::"VisitType",
    (p_data->>'priority')::"AppointmentPriority",
    (p_data->>'type')::"AppointmentType",
    COALESCE((p_data->>'status')::"AppointmentStatus", 'PENDING'),
    v_preferred_datetime,
    p_data->>'reasonForVisit',
    (p_data->>'submittedBy')::"SubmissionSource",
    p_data->>'adminUserId',
    p_data->>'doctorId',
    p_data->>'notes',
    (p_data->>'totalAmount')::numeric,
    now(), now()
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- update_appointment_atomic: replaces updateAppointmentAtomic. p_data is a jsonb
-- patch of columns to update (mirrors the Record<string, unknown> the route already builds).
CREATE OR REPLACE FUNCTION update_appointment_atomic(
  p_clinic_id text,
  p_id text,
  p_data jsonb,
  p_new_preferred_datetime timestamp,
  p_allow_override boolean
)
RETURNS appointments
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict_count integer;
  v_result appointments;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  IF p_new_preferred_datetime IS NOT NULL AND NOT p_allow_override THEN
    SELECT COUNT(*) INTO v_conflict_count
    FROM appointments
    WHERE "clinicId" = p_clinic_id
      AND "preferredDateTime" = p_new_preferred_datetime
      AND status IN ('PENDING', 'OVERDUE', 'CONFIRMED', 'COMPLETED')
      AND id != p_id;
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'SLOT_CONFLICT';
    END IF;
  END IF;

  UPDATE appointments SET
    "bookingChannel" = COALESCE((p_data->>'bookingChannel')::"BookingChannel", "bookingChannel"),
    "visitType" = COALESCE((p_data->>'visitType')::"VisitType", "visitType"),
    priority = COALESCE((p_data->>'priority')::"AppointmentPriority", priority),
    status = COALESCE((p_data->>'status')::"AppointmentStatus", status),
    "preferredDateTime" = COALESCE(p_new_preferred_datetime, "preferredDateTime"),
    "reasonForVisit" = COALESCE(p_data->>'reasonForVisit', "reasonForVisit"),
    "doctorId" = COALESCE(p_data->>'doctorId', "doctorId"),
    notes = COALESCE(p_data->>'notes', notes),
    "totalAmount" = COALESCE((p_data->>'totalAmount')::numeric, "totalAmount"),
    "updatedAt" = now()
  WHERE id = p_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- find_or_create_patient: replaces findOrCreatePatient (patient-id.ts).
CREATE OR REPLACE FUNCTION find_or_create_patient(
  p_clinic_id text,
  p_clinic_short_name text,
  p_timezone text,
  p_data jsonb
)
RETURNS TABLE (id text, "patientId" text, is_new boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing patients;
  v_today_date text;
  v_today_count integer;
  v_new_patient_id text;
  v_new_id text;
BEGIN
  SELECT * INTO v_existing
  FROM patients
  WHERE "clinicId" = p_clinic_id
    AND phone = (p_data->>'phone')
    AND lower(name) = lower(p_data->>'name')
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE patients SET
      email = COALESCE(email, p_data->>'email'),
      age = COALESCE(age, (p_data->>'age')::integer),
      sex = COALESCE(sex, (p_data->>'sex')::"Sex"),
      address = COALESCE(address, p_data->>'address'),
      "updatedAt" = now()
    WHERE patients.id = v_existing.id;

    RETURN QUERY SELECT v_existing.id, v_existing."patientId", false;
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  v_today_date := to_char(now() AT TIME ZONE p_timezone, 'YYYYMMDD');
  SELECT COUNT(*) INTO v_today_count
  FROM patients
  WHERE "clinicId" = p_clinic_id AND "patientId" LIKE (p_clinic_short_name || '-' || v_today_date || '-%');
  v_new_patient_id := p_clinic_short_name || '-' || v_today_date || '-' || lpad((v_today_count + 1)::text, 4, '0');
  v_new_id := gen_random_uuid()::text;

  INSERT INTO patients (id, "clinicId", "patientId", name, phone, email, age, sex, address, "createdAt", "updatedAt")
  VALUES (
    v_new_id, p_clinic_id, v_new_patient_id, p_data->>'name', p_data->>'phone',
    p_data->>'email', (p_data->>'age')::integer, (p_data->>'sex')::"Sex", p_data->>'address',
    now(), now()
  );

  RETURN QUERY SELECT v_new_id, v_new_patient_id, true;
END;
$$;

-- create_prescription_with_id: replaces createPrescriptionWithId (prescription-id.ts).
-- Also updates the appointment status to CONFIRMED, same as the original.
CREATE OR REPLACE FUNCTION create_prescription_with_id(
  p_clinic_id text,
  p_timezone text,
  p_data jsonb
)
RETURNS prescriptions
LANGUAGE plpgsql
AS $$
DECLARE
  v_today_date text;
  v_today_count integer;
  v_prescription_id text;
  v_result prescriptions;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  v_today_date := to_char(now() AT TIME ZONE p_timezone, 'YYYYMMDD');
  SELECT COUNT(*) INTO v_today_count
  FROM prescriptions
  WHERE "clinicId" = p_clinic_id AND "prescriptionId" LIKE ('RX-' || v_today_date || '-%');
  v_prescription_id := 'RX-' || v_today_date || '-' || lpad((v_today_count + 1)::text, 4, '0');

  INSERT INTO prescriptions (
    id, "clinicId", "prescriptionId", "appointmentId", diagnosis, medications,
    "treatmentPlan", "nextVisitDate", advice, "prescribedById", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, p_clinic_id, v_prescription_id,
    p_data->>'appointmentId', p_data->>'diagnosis', p_data->'medications',
    p_data->>'treatmentPlan', (p_data->>'nextVisitDate')::date, p_data->>'advice',
    p_data->>'prescribedById', now(), now()
  )
  RETURNING * INTO v_result;

  UPDATE appointments SET status = 'CONFIRMED', "updatedAt" = now()
  WHERE id = (p_data->>'appointmentId');

  RETURN v_result;
END;
$$;

-- Restrict all four to service_role, matching Phase 3's precedent.
REVOKE ALL ON FUNCTION create_appointment_atomic(text, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_appointment_atomic(text, text, boolean, jsonb) TO service_role;
REVOKE ALL ON FUNCTION update_appointment_atomic(text, text, jsonb, timestamp, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_appointment_atomic(text, text, jsonb, timestamp, boolean) TO service_role;
REVOKE ALL ON FUNCTION find_or_create_patient(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_or_create_patient(text, text, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION create_prescription_with_id(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_prescription_with_id(text, text, jsonb) TO service_role;
```

**Note on `SLOT_CONFLICT`**: the original `SlotConflictError` had a specific user-facing message. `RAISE EXCEPTION 'SLOT_CONFLICT'` surfaces as a Postgres error with that message via `supabase-js`'s `error.message` — route code checks for it explicitly (`if (error.message === 'SLOT_CONFLICT') return 409 ...`) rather than an `instanceof` check, since errors crossing the RPC boundary are plain objects, not JS Error subclasses.

### Step 4 — Update the 4 route files that called the old helpers

Replace `import { createAppointmentAtomic, updateAppointmentAtomic } from "@/lib/utils/slot-conflict"` (and the `patient-id.ts`/`prescription-id.ts` equivalents) with direct `supabase.rpc(...)` calls:
```ts
// was: await createAppointmentAtomic(prisma, { clinicId, timezone, data, allowOverride })
const { data: appointment, error } = await supabase.rpc("create_appointment_atomic", {
  p_clinic_id: clinicId,
  p_timezone: timezone,
  p_allow_override: allowOverride,
  p_data: data,
});
if (error) {
  if (error.message === "SLOT_CONFLICT") return NextResponse.json({ success: false, error: "This time slot is already booked. Please choose another time." }, { status: 409 });
  throw error;
}
```
Apply the equivalent swap in the 4 affected files: `src/app/api/appointments/route.ts` (POST → `find_or_create_patient` + `create_appointment_atomic`), `src/app/api/appointments/[id]/route.ts` (PATCH → `update_appointment_atomic`), `src/app/api/appointments/follow-up/route.ts` (POST → `create_appointment_atomic`), `src/app/api/prescriptions/route.ts` (POST → `create_prescription_with_id`). Each file's surrounding validation/auth/response logic stays untouched — only the data-access call changes, same as Phase 3's route rewrites.

Also convert the now-plain-CRUD Prisma calls that remain *in* these same 4 files (e.g. `appointments/route.ts`'s `clinic.findUnique`, `admin.findUnique`, `patient.findFirst` checks) to `supabase.from(...)` calls in the same pass, since touching the file once is more efficient than a separate later batch — these are Category A, no RPC needed.

`src/lib/utils/slot-conflict.ts`, `patient-id.ts`, `prescription-id.ts` can be deleted once no route imports them anymore (confirm via grep after Step 4).

### Step 5 — Convert `src/lib/data/dashboard.ts`

`fetchDashboardStats` — swap to call the **already-existing** `get_dashboard_stats` RPC from Phase 3 (no new SQL needed):
```ts
const supabase = createAdminClient();
const { data, error } = await supabase
  .rpc("get_dashboard_stats", { p_clinic_id: clinicId, p_today_start: todayStart, p_tomorrow_start: tomorrowStart })
  .single();
```
`fetchAppointments` (same file) — Category A+E: `.from("appointments").select("*, patient:patients(*), prescription:prescriptions(id, prescriptionId), doctor:doctors(id, name, qualifications), payments(amount, method)")` with the existing `where`/pagination translated to `.eq()`/`.range()`. This is the first relation-heavy conversion in the rollout — verify the embedded results shape matches what calling code expects (nested object for 1:1, array for 1:many) before moving to other Category E files.

## Critical files
- `src/generated/supabase/database.types.ts` — new, generated (step 1)
- `src/lib/supabase/admin.ts` — typed with `Database` (step 1)
- `src/lib/auth/require-admin.ts` — converted (step 2)
- New migration `prisma/migrations/<timestamp>_add_appointment_patient_prescription_rpc/` — 4 new RPC functions (step 3)
- `src/app/api/appointments/route.ts`, `appointments/[id]/route.ts`, `appointments/follow-up/route.ts`, `prescriptions/route.ts` — converted (step 4)
- `src/lib/utils/slot-conflict.ts`, `patient-id.ts`, `prescription-id.ts` — deleted once unused
- `src/lib/data/dashboard.ts` — converted (step 5)

## Verification
1. Apply the new migration to the real Supabase DB (confirm before running, per Phase 3's precedent) via `prisma migrate deploy`.
2. Test all 4 new RPC functions directly (raw SQL + real `supabase-js` calls) before touching route code — same two-layer verification as Phase 3, including a deliberate slot-conflict trigger and a deliberate duplicate-patient lookup to confirm the "existing patient" branch works.
3. `npm run dev`, exercise the real booking flow end-to-end (new patient + existing patient, confirm appointment, add prescription) through the actual UI or authenticated `curl`.
4. `npm run lint` / `npx tsc --noEmit` clean.
5. `npx opennextjs-cloudflare build` still succeeds (regression check against Phase 3's fix).
6. Confirm `slot-conflict.ts`/`patient-id.ts`/`prescription-id.ts` have zero remaining importers before deleting them.

## Batch 2+ (not implemented in this plan — scoped for follow-up)
- The 3 remaining inline-`$transaction` route files (`appointments/confirm`, `patients/[id]` DELETE, `patients` DELETE) — each needs its own bespoke RPC function, same shape as Phase 3's `bulk_delete_appointments`.
- The remaining ~26 Category A simple-CRUD files, batched by domain area (admin, doctors, payments, prescriptions, templates, reports, page components) — mechanical once the `require-admin.ts` and relation-embedding conventions from this batch are established.
- Per-file verification of PostgREST's FK-disambiguation syntax (`!fk_name`) for any table with multiple FKs to the same target — not yet hit in this batch, but likely to surface in later ones (e.g. `Appointment` has both `patientId` and, transitively via other tables, could have ambiguous embeds — check case by case).
