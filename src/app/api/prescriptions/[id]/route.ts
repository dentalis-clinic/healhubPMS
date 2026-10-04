import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateOnlyIso, withUtcTimestamps, utcIso } from "@/lib/supabase/serialize";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;

    // Support lookup by UUID or prescriptionId (RX-...)
    const isRxId = id.startsWith("RX-");
    let query = createAdminClient()
      .from("prescriptions")
      .select("*, appointment:appointments(*, patient:patients(*)), prescribedBy:admins(id, name, email)")
      .eq("clinicId", clinic.id);
    query = isRxId ? query.eq("prescriptionId", id) : query.eq("id", id);

    const { data: prescription, error } = await query.maybeSingle();
    if (error) throw error;

    if (!prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 }
      );
    }

    const serialized = {
      ...withUtcTimestamps(prescription),
      nextVisitDate: dateOnlyIso(prescription.nextVisitDate),
      appointment: {
        ...withUtcTimestamps(prescription.appointment),
        preferredDateTime: utcIso(prescription.appointment.preferredDateTime),
        patient: withUtcTimestamps(prescription.appointment.patient),
      },
    };

    return NextResponse.json({ success: true, prescription: serialized });
  } catch (error) {
    console.error("GET /api/prescriptions/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
