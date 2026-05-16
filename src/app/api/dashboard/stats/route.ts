import { NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

interface StatsRow {
  today_appointments: bigint;
  pending_confirmations: bigint;
  patients_seen_today: bigint;
  total_patients: bigint;
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const now = DateTime.now().setZone(clinic.timezone);
    const todayStart = now.startOf("day").toJSDate();
    const tomorrowStart = now.plus({ days: 1 }).startOf("day").toJSDate();
    const clinicId = clinic.id;

    const [stats] = await prisma.$queryRaw<StatsRow[]>`
      SELECT
        COUNT(*) FILTER (
          WHERE "clinicId" = ${clinicId}
            AND "preferredDateTime" >= ${todayStart}
            AND "preferredDateTime" < ${tomorrowStart}
        ) AS today_appointments,
        COUNT(*) FILTER (
          WHERE "clinicId" = ${clinicId}
            AND status IN ('PENDING', 'OVERDUE')
        ) AS pending_confirmations,
        COUNT(*) FILTER (
          WHERE "clinicId" = ${clinicId}
            AND status = 'COMPLETED'
            AND "preferredDateTime" >= ${todayStart}
            AND "preferredDateTime" < ${tomorrowStart}
        ) AS patients_seen_today,
        (SELECT COUNT(*) FROM patients WHERE "clinicId" = ${clinicId}) AS total_patients
      FROM appointments
    `;

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
