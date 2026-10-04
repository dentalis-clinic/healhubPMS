import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcIso } from "@/lib/supabase/serialize";
import { DateTime } from "luxon";

/**
 * GET /api/reports/payments?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Returns payment summary, method breakdown, outstanding bills,
 * and daily collections for the clinic.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const now = DateTime.now().setZone(clinic.timezone);
    const fromIST = fromParam
      ? DateTime.fromISO(fromParam, { zone: clinic.timezone }).startOf("day")
      : now.startOf("month");
    const toIST = toParam
      ? DateTime.fromISO(toParam, { zone: clinic.timezone }).endOf("day")
      : now.endOf("day");

    const fromUTC = fromIST.toUTC().toISO();
    const toUTC = toIST.toUTC().toISO();

    const supabase = createAdminClient();
    const [
      { data: periodPayments, error: periodPaymentsError },
      { data: billedAppointments, error: billedError },
      { data: allBillableAppointments, error: allBillableError },
    ] = await Promise.all([
      supabase
        .from("payments")
        .select("amount, method, paidAt, appointmentId")
        .eq("clinicId", clinic.id)
        .gte("paidAt", fromUTC)
        .lte("paidAt", toUTC),

      supabase
        .from("appointments")
        .select("totalAmount")
        .eq("clinicId", clinic.id)
        .in("status", ["CONFIRMED", "COMPLETED"])
        .not("totalAmount", "is", null)
        .gte("preferredDateTime", fromUTC)
        .lte("preferredDateTime", toUTC),

      supabase
        .from("appointments")
        .select("id, appointmentId, totalAmount, preferredDateTime, patient:patients(name, phone), payments(amount, method)")
        .eq("clinicId", clinic.id)
        .in("status", ["CONFIRMED", "COMPLETED"])
        .not("totalAmount", "is", null)
        .order("preferredDateTime", { ascending: true }),
    ]);
    if (periodPaymentsError) throw periodPaymentsError;
    if (billedError) throw billedError;
    if (allBillableError) throw allBillableError;

    const totalCollected = periodPayments
      .filter((p) => p.method !== "WAIVED")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalWaived = periodPayments
      .filter((p) => p.method === "WAIVED")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const totalBilled = billedAppointments.reduce(
      (sum, a) => sum + Number(a.totalAmount),
      0
    );

    const methodMap = new Map<string, { amount: number; count: number }>();
    for (const p of periodPayments) {
      const existing = methodMap.get(p.method) ?? { amount: 0, count: 0 };
      methodMap.set(p.method, {
        amount: existing.amount + Number(p.amount),
        count: existing.count + 1,
      });
    }
    const methodBreakdown = Array.from(methodMap.entries())
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.amount - a.amount);

    const outstandingBills = allBillableAppointments
      .map((a) => {
        const paid = a.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const amountDue = Number(a.totalAmount);
        const balance = amountDue - paid;
        return {
          appointmentId: a.id,
          appointmentRef: a.appointmentId,
          patientName: a.patient.name,
          phone: a.patient.phone,
          amountDue,
          totalPaid: Math.round(paid * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          preferredDateTime: utcIso(a.preferredDateTime),
        };
      })
      .filter((b) => b.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    const dailyMap = new Map<string, { collected: number; waived: number }>();
    for (const p of periodPayments) {
      // PostgREST returns timestamp columns without a zone; treat as UTC.
      const dateKey = DateTime.fromISO(p.paidAt + "Z")
        .setZone(clinic.timezone)
        .toFormat("yyyy-MM-dd");
      const existing = dailyMap.get(dateKey) ?? { collected: 0, waived: 0 };
      if (p.method === "WAIVED") {
        existing.waived += Number(p.amount);
      } else {
        existing.collected += Number(p.amount);
      }
      dailyMap.set(dateKey, existing);
    }
    const dailyCollections = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      period: {
        from: fromIST.toFormat("yyyy-MM-dd"),
        to: toIST.toFormat("yyyy-MM-dd"),
      },
      summary: {
        totalBilled: Math.round(totalBilled * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        totalWaived: Math.round(totalWaived * 100) / 100,
        appointmentCount: billedAppointments.length,
        outstandingTotal: Math.round(
          outstandingBills.reduce((sum, b) => sum + b.balance, 0) * 100
        ) / 100,
        outstandingCount: outstandingBills.length,
      },
      methodBreakdown,
      outstandingBills,
      dailyCollections,
    });
  } catch (error) {
    console.error("GET /api/reports/payments error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
