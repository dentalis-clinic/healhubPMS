import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcIso } from "@/lib/supabase/serialize";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const searchParams = request.nextUrl.searchParams;
    const phone = searchParams.get("phone");

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch {
      return NextResponse.json({ success: true, patients: [] });
    }

    const { data: patients, error } = await createAdminClient()
      .from("patients")
      .select("id, patientId, name, sex, email, age, appointments(preferredDateTime)")
      .eq("clinicId", clinic.id)
      .eq("phone", normalizedPhone)
      .order("preferredDateTime", { referencedTable: "appointments", ascending: false })
      .limit(1, { referencedTable: "appointments" });
    if (error) throw error;

    const result = patients.map((p) => ({
      id: p.id,
      patientId: p.patientId,
      name: p.name,
      sex: p.sex,
      email: p.email,
      age: p.age,
      lastVisitDate: p.appointments.length > 0 ? utcIso(p.appointments[0].preferredDateTime) : null,
    }));

    return NextResponse.json({ success: true, patients: result });
  } catch (error) {
    console.error("Patient lookup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to lookup patients" },
      { status: 500 }
    );
  }
}
