import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const now = DateTime.now().setZone(clinic.timezone);
    const todayStart = now.startOf("day").toJSDate();
    const tomorrowStart = now.plus({ days: 1 }).startOf("day").toJSDate();
    const clinicId = clinic.id;

    const supabase = createAdminClient();
    const { data: stats, error } = await supabase
      .rpc("get_dashboard_stats", {
        p_clinic_id: clinicId,
        p_today_start: todayStart.toISOString(),
        p_tomorrow_start: tomorrowStart.toISOString(),
      })
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      stats: {
        todayAppointments: Number(stats.today_appointments),
        pendingConfirmations: Number(stats.pending_confirmations),
        patientsSeenToday: Number(stats.patients_seen_today),
        totalPatients: Number(stats.total_patients),
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/stats error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
