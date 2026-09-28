-- Batch 2b: patients routes (src/app/api/patients/route.ts, patients/[id]/route.ts).

-- ---------------------------------------------------------------------------
-- delete_patients — replaces both inline Serializable $transactions (bulk and
-- single DELETE). Removes the patients' appointments with their prescriptions
-- and payments (all FKs are ON DELETE RESTRICT), then the patients. Only ids
-- belonging to p_clinic_id are touched. Takes the per-clinic lock used by
-- create_appointment_atomic, so a booking can't be inserted for a patient
-- between collecting their appointments and deleting them. Returns the number
-- of patients deleted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_patients(p_clinic_id text, p_ids text[])
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_patient_ids text[];
  v_appointment_ids text[];
  v_deleted integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  SELECT array_agg(id) INTO v_patient_ids
  FROM patients
  WHERE "clinicId" = p_clinic_id AND id = ANY(p_ids);

  IF v_patient_ids IS NULL THEN
    RETURN 0;
  END IF;

  SELECT array_agg(id) INTO v_appointment_ids
  FROM appointments
  WHERE "clinicId" = p_clinic_id AND "patientId" = ANY(v_patient_ids);

  IF v_appointment_ids IS NOT NULL THEN
    DELETE FROM prescriptions WHERE "appointmentId" = ANY(v_appointment_ids);
    DELETE FROM payments WHERE "appointmentId" = ANY(v_appointment_ids);
    DELETE FROM appointments WHERE id = ANY(v_appointment_ids);
  END IF;

  DELETE FROM patients WHERE id = ANY(v_patient_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ---------------------------------------------------------------------------
-- search_patients — replaces the GET list query. Set-returning, so callers
-- page/sort/count through PostgREST (.order/.range/{count:"exact"}) exactly
-- like a table. Matching is literal (strpos), so % _ * in a search term are
-- not wildcards; case-insensitive on name/patientId/email, as before.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION search_patients(p_clinic_id text, p_search text DEFAULT '')
RETURNS TABLE (
  id text,
  "patientId" text,
  name text,
  phone text,
  email text,
  age integer,
  sex "Sex",
  address text,
  "createdAt" timestamp,
  "totalVisits" integer,
  "lastVisit" timestamp
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id, p."patientId", p.name, p.phone, p.email, p.age, p.sex, p.address, p."createdAt",
    (SELECT count(*)::integer FROM appointments a WHERE a."patientId" = p.id),
    (SELECT max(a."preferredDateTime") FROM appointments a WHERE a."patientId" = p.id)
  FROM patients p
  WHERE p."clinicId" = p_clinic_id
    AND (
      COALESCE(p_search, '') = ''
      OR strpos(lower(p.name), lower(p_search)) > 0
      OR strpos(p.phone, p_search) > 0
      OR strpos(lower(p."patientId"), lower(p_search)) > 0
      OR strpos(lower(COALESCE(p.email, '')), lower(p_search)) > 0
    );
$$;

-- ---------------------------------------------------------------------------
-- bulk_delete_appointments (Phase 3) — also delete the appointments' payments.
-- payments_appointmentId_fkey is ON DELETE RESTRICT, so bulk-deleting any
-- appointment with a recorded payment failed (500). Pre-existing: the original
-- Prisma transaction had the same gap. Now consistent with patient deletion.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bulk_delete_appointments(
  p_clinic_id text,
  p_ids text[]
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  safe_ids text[];
  deleted_count integer;
BEGIN
  SELECT array_agg(id) INTO safe_ids
  FROM appointments
  WHERE "clinicId" = p_clinic_id AND id = ANY(p_ids);

  IF safe_ids IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM prescriptions WHERE "appointmentId" = ANY(safe_ids);
  DELETE FROM payments WHERE "appointmentId" = ANY(safe_ids);
  DELETE FROM appointments WHERE id = ANY(safe_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION delete_patients(text, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION search_patients(text, text) FROM PUBLIC, anon, authenticated;
-- CREATE OR REPLACE keeps existing grants; re-assert for bulk_delete_appointments anyway.
REVOKE ALL ON FUNCTION bulk_delete_appointments(text, text[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION delete_patients(text, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION search_patients(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION bulk_delete_appointments(text, text[]) TO service_role;
