-- get_dashboard_stats: reproduces the exact aggregate query from
-- src/app/api/dashboard/stats/route.ts via a single RPC call.
CREATE OR REPLACE FUNCTION get_dashboard_stats(
  p_clinic_id text,
  p_today_start timestamp,
  p_tomorrow_start timestamp
)
RETURNS TABLE (
  today_appointments bigint,
  pending_confirmations bigint,
  patients_seen_today bigint,
  total_patients bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COUNT(*) FILTER (
      WHERE "clinicId" = p_clinic_id
        AND "preferredDateTime" >= p_today_start
        AND "preferredDateTime" < p_tomorrow_start
    ) AS today_appointments,
    COUNT(*) FILTER (
      WHERE "clinicId" = p_clinic_id
        AND status IN ('PENDING', 'OVERDUE')
    ) AS pending_confirmations,
    COUNT(*) FILTER (
      WHERE "clinicId" = p_clinic_id
        AND status = 'COMPLETED'
        AND "preferredDateTime" >= p_today_start
        AND "preferredDateTime" < p_tomorrow_start
    ) AS patients_seen_today,
    (SELECT COUNT(*) FROM patients WHERE "clinicId" = p_clinic_id) AS total_patients
  FROM appointments;
$$;

REVOKE ALL ON FUNCTION get_dashboard_stats(text, timestamp, timestamp) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_dashboard_stats(text, timestamp, timestamp) TO service_role;

-- bulk_delete_appointments: reproduces the exact interactive transaction from
-- src/app/api/appointments/bulk-delete/route.ts. A single function call runs
-- as one implicit Postgres transaction, giving the same atomicity guarantee
-- (never possible to delete prescriptions without their appointment, or vice versa).
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
  DELETE FROM appointments WHERE id = ANY(safe_ids);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION bulk_delete_appointments(text, text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bulk_delete_appointments(text, text[]) TO service_role;
