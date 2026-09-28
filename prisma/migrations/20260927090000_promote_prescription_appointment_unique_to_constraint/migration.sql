-- Promote the existing unique INDEX on prescriptions."appointmentId" to a
-- unique CONSTRAINT (reuses the index — no rebuild, no data touched).
--
-- Prisma implements @unique as an index; PostgREST and `supabase gen types`
-- only infer one-to-one relationships from constraints. Without this, embedding
-- `prescription:prescriptions(...)` from appointments returns an array ([] when
-- none), which is truthy — `if (appointment.prescription)` silently misbehaves.
-- Prisma introspects both forms as @unique, so schema.prisma is unchanged.
ALTER TABLE "prescriptions"
  ADD CONSTRAINT "prescriptions_appointmentId_key" UNIQUE USING INDEX "prescriptions_appointmentId_key";
