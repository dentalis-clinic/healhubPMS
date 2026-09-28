import { DateTime } from "luxon";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcIso, withUtcTimestamps } from "@/lib/supabase/serialize";

/**
 * Server-side data fetchers for the dashboard.
 * Called directly from Server Components — no HTTP overhead, no re-auth.
 * Callers must resolve clinicId (and timezone) from the session/subdomain and pass them in.
 *
 * Status transitions (PENDING→OVERDUE, CONFIRMED→COMPLETED) are handled by
 * Supabase pg_cron (scripts/setup-pg-cron.sql) — not on the read path.
 */

export interface DashboardStatsData {
  todayAppointments: number;
  pendingConfirmations: number;
  patientsSeenToday: number;
  totalPatients: number;
}

function getTodayBounds(timezone: string) {
  const now = DateTime.now().setZone(timezone);
  return {
    todayStart: now.startOf("day").toJSDate().toISOString(),
    tomorrowStart: now.plus({ days: 1 }).startOf("day").toJSDate().toISOString(),
  };
}

export async function fetchDashboardStats(clinicId: string, timezone: string): Promise<DashboardStatsData> {
  const { todayStart, tomorrowStart } = getTodayBounds(timezone);

  // Same RPC as /api/dashboard/stats.
  const { data: stats, error } = await createAdminClient()
    .rpc("get_dashboard_stats", {
      p_clinic_id: clinicId,
      p_today_start: todayStart,
      p_tomorrow_start: tomorrowStart,
    })
    .single();
  if (error) throw error;

  return {
    todayAppointments: Number(stats.today_appointments),
    pendingConfirmations: Number(stats.pending_confirmations),
    patientsSeenToday: Number(stats.patients_seen_today),
    totalPatients: Number(stats.total_patients),
  };
}

type DateFilter = "today" | "upcoming" | "all";

const PAGE_SIZE = 30;

export async function fetchAppointments(dateFilter: DateFilter = "today", clinicId: string, timezone: string) {
  let query = createAdminClient()
    .from("appointments")
    .select(
      "*, patient:patients(*), prescription:prescriptions(id, prescriptionId), doctor:doctors(id, name, qualifications), payments(amount, method)",
      { count: "exact" }
    )
    .eq("clinicId", clinicId);

  if (dateFilter === "today" || dateFilter === "upcoming") {
    const { todayStart, tomorrowStart } = getTodayBounds(timezone);

    if (dateFilter === "today") {
      query = query.gte("preferredDateTime", todayStart).lt("preferredDateTime", tomorrowStart);
    } else {
      query = query.gte("preferredDateTime", tomorrowStart).neq("status", "CANCELLED");
    }
  }

  const { data: appointments, count, error } = await (dateFilter === "today"
    ? query.order("preferredDateTime", { ascending: true })
    : query.order("createdAt", { ascending: false })
  ).range(0, PAGE_SIZE - 1);
  if (error) throw error;

  const serialized = appointments.map(({ payments, ...a }) => {
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
  });

  return { appointments: serialized, total: count ?? 0 };
}
