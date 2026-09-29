import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcIso } from "@/lib/supabase/serialize";

/**
 * GET /api/payments/open-bills?patientId=<uuid>
 *
 * Returns all CONFIRMED/COMPLETED appointments for a patient that have
 * a totalAmount set but an outstanding balance > 0.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patientId");

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "patientId is required" },
        { status: 400 }
      );
    }

    const { data: appointments, error } = await createAdminClient()
      .from("appointments")
      .select("id, appointmentId, preferredDateTime, status, totalAmount, reasonForVisit, payments(amount, method)")
      .eq("clinicId", clinic.id)
      .eq("patientId", patientId)
      .neq("status", "CANCELLED")
      .not("totalAmount", "is", null)
      .order("preferredDateTime", { ascending: false });
    if (error) throw error;

    const openBills = appointments
      .map((apt) => {
        const totalPaid = apt.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const amountDue = Number(apt.totalAmount);
        const balance = amountDue - totalPaid;

        return {
          appointmentId: apt.id,
          appointmentRef: apt.appointmentId,
          preferredDateTime: utcIso(apt.preferredDateTime),
          status: apt.status,
          amountDue,
          totalPaid: Math.round(totalPaid * 100) / 100,
          balance: Math.round(balance * 100) / 100,
          reasonForVisit: apt.reasonForVisit,
        };
      })
      .filter((bill) => bill.balance > 0);

    return NextResponse.json({ success: true, openBills });
  } catch (error) {
    console.error("GET /api/payments/open-bills error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
