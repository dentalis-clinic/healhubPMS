-- confirm_appointment: replaces the inline Serializable $transaction in
-- src/app/api/appointments/confirm/route.ts (Flow A — confirm an existing
-- PENDING/OVERDUE/TENTATIVE appointment).
--
-- One transaction, serialized per clinic (same lock as the other appointment
-- RPCs): slot-conflict check, patient patch, appointment update. A slot
-- conflict rolls back the patient patch too, matching the old behavior.
--
-- The confirmable-status check is re-done inside the lock (the route's check
-- runs before it), so an appointment cancelled concurrently can't be
-- confirmed. Raises SLOT_CONFLICT, NOT_FOUND, or NOT_CONFIRMABLE.
--
-- p_patient_data / p_appointment_data are patches: a PRESENT key sets that
-- column; an absent key leaves it alone.
CREATE OR REPLACE FUNCTION confirm_appointment(
  p_clinic_id text,
  p_id text,
  p_patient_data jsonb,
  p_appointment_data jsonb,
  p_allow_override boolean DEFAULT false
)
RETURNS appointments
LANGUAGE plpgsql
AS $$
DECLARE
  v_current appointments;
  v_preferred timestamp := ((p_appointment_data->>'preferredDateTime')::timestamptz AT TIME ZONE 'UTC');
  v_result appointments;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_clinic_id));

  SELECT * INTO v_current FROM appointments
  WHERE id = p_id AND "clinicId" = p_clinic_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  IF v_current.status NOT IN ('PENDING', 'OVERDUE', 'TENTATIVE') THEN
    RAISE EXCEPTION 'NOT_CONFIRMABLE';
  END IF;

  IF v_preferred IS NOT NULL AND NOT p_allow_override AND EXISTS (
    SELECT 1 FROM appointments
    WHERE "clinicId" = p_clinic_id
      AND "preferredDateTime" = v_preferred
      AND status IN ('PENDING', 'OVERDUE', 'CONFIRMED', 'COMPLETED')
      AND id <> p_id
  ) THEN
    RAISE EXCEPTION 'SLOT_CONFLICT';
  END IF;

  IF p_patient_data IS NOT NULL AND p_patient_data <> '{}'::jsonb THEN
    UPDATE patients SET
      name      = CASE WHEN p_patient_data ? 'name'    THEN p_patient_data->>'name'           ELSE name END,
      sex       = CASE WHEN p_patient_data ? 'sex'     THEN (p_patient_data->>'sex')::"Sex"   ELSE sex END,
      email     = CASE WHEN p_patient_data ? 'email'   THEN p_patient_data->>'email'          ELSE email END,
      address   = CASE WHEN p_patient_data ? 'address' THEN p_patient_data->>'address'        ELSE address END,
      age       = CASE WHEN p_patient_data ? 'age'     THEN (p_patient_data->>'age')::integer ELSE age END,
      "updatedAt" = now() AT TIME ZONE 'UTC'
    WHERE id = v_current."patientId" AND "clinicId" = p_clinic_id;
  END IF;

  UPDATE appointments SET
    status              = 'CONFIRMED',
    "preferredDateTime" = COALESCE(v_preferred, "preferredDateTime"),
    "reasonForVisit"    = CASE WHEN p_appointment_data ? 'reasonForVisit' THEN p_appointment_data->>'reasonForVisit'  ELSE "reasonForVisit" END,
    "adminUserId"       = CASE WHEN p_appointment_data ? 'adminUserId'    THEN p_appointment_data->>'adminUserId'     ELSE "adminUserId" END,
    "doctorId"          = CASE WHEN p_appointment_data ? 'doctorId'       THEN p_appointment_data->>'doctorId'        ELSE "doctorId" END,
    "totalAmount"       = CASE WHEN p_appointment_data ? 'totalAmount'    THEN (p_appointment_data->>'totalAmount')::numeric ELSE "totalAmount" END,
    "updatedAt"         = now() AT TIME ZONE 'UTC'
  WHERE id = p_id AND "clinicId" = p_clinic_id
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION confirm_appointment(text, text, jsonb, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_appointment(text, text, jsonb, jsonb, boolean) TO service_role;
