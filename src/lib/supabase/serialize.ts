import type { Tables } from "@/generated/supabase/database.types";

/**
 * PostgREST → API response normalization.
 *
 * Every Prisma `DateTime` column is `timestamp without time zone` holding UTC.
 * Prisma returned `Date`s (serialized as "…T10:00:00.000Z"), but PostgREST
 * returns the raw value "…T10:00:00" with no zone — which `new Date()` and
 * Luxon parse as *local* time. Always pass timestamps through these before
 * returning them from a route.
 */

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/;

/** `timestamp` column → ISO string in UTC, identical to Prisma's `Date#toISOString()`. */
export function utcIso(ts: string): string;
export function utcIso(ts: string | null): string | null;
export function utcIso(ts: string | null): string | null {
  if (ts == null) return null;
  return new Date(HAS_ZONE.test(ts) ? ts : `${ts}Z`).toISOString();
}

/** `@db.Date` column ("2026-09-30") → UTC midnight ISO, as Prisma returned it. */
export function dateOnlyIso(d: string | null): string | null {
  return d == null ? null : `${d}T00:00:00.000Z`;
}

/** Normalizes the `createdAt` / `updatedAt` pair every table has. */
export function withUtcTimestamps<T extends { createdAt: string; updatedAt: string }>(row: T): T {
  return { ...row, createdAt: utcIso(row.createdAt), updatedAt: utcIso(row.updatedAt) };
}

/**
 * Shape of an `appointments` row selected with:
 * `"*, patient:patients(*), prescription:prescriptions(id, prescriptionId), doctor:doctors(id, name, qualifications), payments(amount, method)"`
 * — shared by `lib/data/dashboard.ts` and `api/appointments/list`.
 */
export interface AppointmentWithRelationsRow extends Tables<"appointments"> {
  patient: Tables<"patients">;
  prescription: Pick<Tables<"prescriptions">, "id" | "prescriptionId"> | null;
  doctor: Pick<Tables<"doctors">, "id" | "name" | "qualifications"> | null;
  payments: Pick<Tables<"payments">, "amount" | "method">[];
}

/** Computes totalPaid/isWaived from `payments` and normalizes timestamps/Decimal fields. */
export function serializeAppointmentWithRelations(row: AppointmentWithRelationsRow) {
  const { payments, ...a } = row;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const isWaived = payments.some((p) => p.method === "WAIVED");
  return {
    ...withUtcTimestamps(a),
    isWaived,
    preferredDateTime: utcIso(a.preferredDateTime),
    totalAmount: a.totalAmount != null ? Number(a.totalAmount) : null,
    totalPaid,
    patient: withUtcTimestamps(a.patient),
  };
}
