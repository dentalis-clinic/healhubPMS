-- Rollout Batch 1: replaces the Prisma $transaction helpers in
-- src/lib/utils/slot-conflict.ts, patient-id.ts, prescription-id.ts with RPCs.
--
-- Concurrency: each function takes pg_advisory_xact_lock(hashtext(clinicId)),
-- serializing ID generation / slot checks per clinic (clinics never block each
-- other). The lock is released at transaction end, i.e. when the RPC returns.
--
-- Serials use MAX(existing)+1, not COUNT+1: after a same-day delete, COUNT+1
-- re-issues an ID that still exists. The old helpers only survived that via
-- their retry-with-offset loop, which these functions don't need.
--
-- Timestamps: columns are `timestamp without time zone` holding UTC (Prisma
-- convention). Inputs are cast via ::timestamptz AT TIME ZONE 'UTC' so an
-- ISO string with any offset lands correctly (a bare ::timestamp silently
-- drops the offset).

-- ---------------------------------------------------------------------------
-- 1. Per-clinic uniqueness for patientId / prescriptionId.
-- Both were globally unique but generated per clinic: two clinics issuing
-- their first RX of the day both produce RX-YYYYMMDD-0001. appointments
-- already uses (clinicId, appointmentId). Loosening only — every existing row
-- satisfies the composite constraint.
-- ---------------------------------------------------------------------------
DROP INDEX "patients_patientId_key";
CREATE UNIQUE INDEX "patients_clinicId_patientId_key" ON "patients"("clinicId", "patientId");

DROP INDEX "prescriptions_prescriptionId_key";
CREATE UNIQUE INDEX "prescriptions_clinicId_prescriptionId_key" ON "prescriptions"("clinicId", "prescriptionId");

-- ---------------------------------------------------------------------------
-- Shared: next serial for a {prefix}-NNNN ID. Caller must hold the clinic lock.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _next_daily_serial_id(p_prefix text, p_max_existing integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  -- lpad truncates past the width, so widen it rather than wrap at 9999.
  SELECT p_prefix || '-' || lpad((COALESCE(p_max_existing, 0) + 1)::text,
                                 greatest(4, length((COALESCE(p_max_existing, 0) + 1)::text)), '0');
$$;

-- ---------------------------------------------------------------------------
-- 2. create_appointment_atomic — replaces createAppointmentAtomic.
-- Raises 'SLOT_CONFLICT' if the slot is taken (unless p_allow_override).
-- ---------------------------------------------------------------------------
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
  v_preferred timestamp := ((p_data->>'preferredDateTime')::timestamptz AT TIME ZONE 'UTC');
  v_prefix text := 'APT-' || to_char(now() AT TIME ZONE p_timezone, 'YYYYMMDD');
  v_max integer;
  v_result appointments;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  IF NOT p_allow_override AND EXISTS (
    SELECT 1 FROM appointments
    WHERE "clinicId" = p_clinic_id
      AND "preferredDateTime" = v_preferred
      AND status IN ('PENDING', 'OVERDUE', 'CONFIRMED', 'COMPLETED')
  ) THEN
    RAISE EXCEPTION 'SLOT_CONFLICT';
  END IF;

  SELECT max(substring("appointmentId" FROM '-(\d+)$')::integer) INTO v_max
  FROM appointments
  WHERE "clinicId" = p_clinic_id AND "appointmentId" LIKE v_prefix || '-%';

  INSERT INTO appointments (
    id, "clinicId", "appointmentId", "patientId", "bookingChannel", "visitType",
    priority, type, status, "preferredDateTime", "reasonForVisit", "submittedBy",
    "adminUserId", "doctorId", notes, "totalAmount", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, p_clinic_id, _next_daily_serial_id(v_prefix, v_max),
    p_data->>'patientId',
    (p_data->>'bookingChannel')::"BookingChannel",
    (p_data->>'visitType')::"VisitType",
    (p_data->>'priority')::"AppointmentPriority",
    (p_data->>'type')::"AppointmentType",
    COALESCE((p_data->>'status')::"AppointmentStatus", 'PENDING'),
    v_preferred,
    p_data->>'reasonForVisit',
    (p_data->>'submittedBy')::"SubmissionSource",
    p_data->>'adminUserId',
    p_data->>'doctorId',
    p_data->>'notes',
    (p_data->>'totalAmount')::numeric,
    now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. update_appointment_atomic — replaces updateAppointmentAtomic.
-- p_data is a patch: a key PRESENT (even with JSON null) sets the column; an
-- absent key leaves it alone. This preserves the route's ability to clear
-- doctorId / notes / totalAmount etc. (COALESCE-based updates could not).
-- Scoped by clinic; raises 'NOT_FOUND' if no row matched.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_appointment_atomic(
  p_clinic_id text,
  p_id text,
  p_data jsonb,
  p_allow_override boolean DEFAULT false
)
RETURNS appointments
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_preferred timestamp;
  v_result appointments;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  IF p_data ? 'preferredDateTime' THEN
    v_new_preferred := ((p_data->>'preferredDateTime')::timestamptz AT TIME ZONE 'UTC');

    IF NOT p_allow_override AND EXISTS (
      SELECT 1 FROM appointments
      WHERE "clinicId" = p_clinic_id
        AND "preferredDateTime" = v_new_preferred
        AND status IN ('PENDING', 'OVERDUE', 'CONFIRMED', 'COMPLETED')
        AND id <> p_id
    ) THEN
      RAISE EXCEPTION 'SLOT_CONFLICT';
    END IF;
  END IF;

  UPDATE appointments SET
    status            = CASE WHEN p_data ? 'status'            THEN (p_data->>'status')::"AppointmentStatus"           ELSE status END,
    "bookingChannel"  = CASE WHEN p_data ? 'bookingChannel'    THEN (p_data->>'bookingChannel')::"BookingChannel"      ELSE "bookingChannel" END,
    "visitType"       = CASE WHEN p_data ? 'visitType'         THEN (p_data->>'visitType')::"VisitType"                ELSE "visitType" END,
    priority          = CASE WHEN p_data ? 'priority'          THEN (p_data->>'priority')::"AppointmentPriority"       ELSE priority END,
    "doctorId"        = CASE WHEN p_data ? 'doctorId'          THEN p_data->>'doctorId'                                ELSE "doctorId" END,
    "totalAmount"     = CASE WHEN p_data ? 'totalAmount'       THEN (p_data->>'totalAmount')::numeric                  ELSE "totalAmount" END,
    "reasonForVisit"  = CASE WHEN p_data ? 'reasonForVisit'    THEN p_data->>'reasonForVisit'                          ELSE "reasonForVisit" END,
    notes             = CASE WHEN p_data ? 'notes'             THEN p_data->>'notes'                                   ELSE notes END,
    "preferredDateTime" = COALESCE(v_new_preferred, "preferredDateTime"),
    "updatedAt"       = now() AT TIME ZONE 'UTC'
  WHERE id = p_id AND "clinicId" = p_clinic_id
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. find_or_create_patient — replaces findOrCreatePatient.
-- Caller passes an already-normalized phone. The lock is taken BEFORE the
-- lookup, closing the old race where two simultaneous first-time bookings for
-- the same person both missed the lookup and created duplicate patients.
-- On a match, only fills fields that are currently null (same as before).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_or_create_patient(
  p_clinic_id text,
  p_clinic_short_name text,
  p_timezone text,
  p_data jsonb
)
RETURNS TABLE (id text, "patientId" text, "isNew" boolean)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
DECLARE
  v_existing patients;
  v_email text := NULLIF(p_data->>'email', '');
  v_age integer := (p_data->>'age')::integer;
  v_sex "Sex" := NULLIF(p_data->>'sex', '')::"Sex";
  v_address text := NULLIF(p_data->>'address', '');
  v_prefix text := p_clinic_short_name || '-' || to_char(now() AT TIME ZONE p_timezone, 'YYYYMMDD');
  v_max integer;
  v_new_id text := gen_random_uuid()::text;
  v_new_patient_id text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  SELECT * INTO v_existing
  FROM patients p
  WHERE p."clinicId" = p_clinic_id
    AND p.phone = p_data->>'phone'
    AND lower(p.name) = lower(p_data->>'name')
  LIMIT 1;

  IF FOUND THEN
    UPDATE patients p SET
      email     = COALESCE(p.email, v_email),
      age       = COALESCE(p.age, v_age),
      sex       = COALESCE(p.sex, v_sex),
      address   = COALESCE(p.address, v_address),
      "updatedAt" = now() AT TIME ZONE 'UTC'
    WHERE p.id = v_existing.id
      AND ((p.email IS NULL AND v_email IS NOT NULL)
        OR (p.age IS NULL AND v_age IS NOT NULL)
        OR (p.sex IS NULL AND v_sex IS NOT NULL)
        OR (p.address IS NULL AND v_address IS NOT NULL));

    RETURN QUERY SELECT v_existing.id, v_existing."patientId", false;
    RETURN;
  END IF;

  SELECT max(substring(p."patientId" FROM '-(\d+)$')::integer) INTO v_max
  FROM patients p
  WHERE p."clinicId" = p_clinic_id AND p."patientId" LIKE v_prefix || '-%';

  v_new_patient_id := _next_daily_serial_id(v_prefix, v_max);

  INSERT INTO patients (id, "clinicId", "patientId", name, phone, email, age, sex, address, "createdAt", "updatedAt")
  VALUES (
    v_new_id, p_clinic_id, v_new_patient_id, p_data->>'name', p_data->>'phone',
    v_email, v_age, v_sex, v_address,
    now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
  );

  RETURN QUERY SELECT v_new_id, v_new_patient_id, true;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. create_prescription_with_id — replaces createPrescriptionWithId.
-- Also sets the appointment to CONFIRMED (same as before), scoped by clinic.
-- A second prescription for the same appointment still fails on the
-- prescriptions_appointmentId_key unique index (SQLSTATE 23505).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_prescription_with_id(
  p_clinic_id text,
  p_timezone text,
  p_data jsonb
)
RETURNS prescriptions
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix text := 'RX-' || to_char(now() AT TIME ZONE p_timezone, 'YYYYMMDD');
  v_max integer;
  v_result prescriptions;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  SELECT max(substring("prescriptionId" FROM '-(\d+)$')::integer) INTO v_max
  FROM prescriptions
  WHERE "clinicId" = p_clinic_id AND "prescriptionId" LIKE v_prefix || '-%';

  INSERT INTO prescriptions (
    id, "clinicId", "prescriptionId", "appointmentId", diagnosis, medications,
    "treatmentPlan", "nextVisitDate", advice, "prescribedById", "createdAt", "updatedAt"
  ) VALUES (
    gen_random_uuid()::text, p_clinic_id, _next_daily_serial_id(v_prefix, v_max),
    p_data->>'appointmentId',
    p_data->>'diagnosis',
    p_data->'medications',
    NULLIF(p_data->>'treatmentPlan', ''),
    ((NULLIF(p_data->>'nextVisitDate', '')::timestamptz AT TIME ZONE 'UTC')::date),
    NULLIF(p_data->>'advice', ''),
    p_data->>'prescribedById',
    now() AT TIME ZONE 'UTC', now() AT TIME ZONE 'UTC'
  )
  RETURNING * INTO v_result;

  UPDATE appointments SET status = 'CONFIRMED', "updatedAt" = now() AT TIME ZONE 'UTC'
  WHERE id = p_data->>'appointmentId' AND "clinicId" = p_clinic_id;

  RETURN v_result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Privileges. Supabase's default privileges grant EXECUTE on new public
-- functions directly to anon/authenticated, so REVOKE ... FROM PUBLIC alone
-- (Phase 3's approach) left them callable with the anon key. Not exploitable
-- today — these are SECURITY INVOKER and RLS denies anon every row — but the
-- app only calls them with service_role, so close it explicitly. Also fixes
-- the two Phase 3 functions.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION _next_daily_serial_id(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_appointment_atomic(text, text, boolean, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION update_appointment_atomic(text, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION find_or_create_patient(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION create_prescription_with_id(text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_dashboard_stats(text, timestamp, timestamp) FROM anon, authenticated;
REVOKE ALL ON FUNCTION bulk_delete_appointments(text, text[]) FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION _next_daily_serial_id(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION create_appointment_atomic(text, text, boolean, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION update_appointment_atomic(text, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION find_or_create_patient(text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION create_prescription_with_id(text, text, jsonb) TO service_role;
