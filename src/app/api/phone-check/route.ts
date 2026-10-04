import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { maskName } from "@/lib/utils/mask-name";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { generatePatientToken } from "@/lib/utils/patient-token";
import { getClinicContext } from "@/lib/utils/clinic-context";
import { utcIso } from "@/lib/supabase/serialize";
import type { PhoneCheckStatus, MaskedPatient } from "@/types/patient";

const PHONE_CHECK_RATE_LIMIT = 10;

export async function GET(request: NextRequest) {
  try {
    const { clinic, error } = getClinicContext(request);
    if (error) return error;

    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      "unknown";
    const { allowed } = await checkRateLimit(ip, {
      namespace: "phone-check",
      max: PHONE_CHECK_RATE_LIMIT,
    });

    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const phone = request.nextUrl.searchParams.get("phone");
    if (!phone) {
      return NextResponse.json({ success: true, status: "new" as PhoneCheckStatus, patients: [] });
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch {
      return NextResponse.json({ success: true, status: "new" as PhoneCheckStatus, patients: [] });
    }

    // Dot-path filter + embedded order/limit: filters which appointment ROW is
    // embedded (not which patients are returned — a patient with no matching
    // appointment still comes back, with an empty `appointments` array).
    const { data: patients, error: patientsError } = await createAdminClient()
      .from("patients")
      .select("id, name, appointments(preferredDateTime)")
      .eq("clinicId", clinic.clinicId)
      .eq("phone", normalizedPhone)
      .in("appointments.status", ["PENDING", "OVERDUE"])
      .gt("appointments.preferredDateTime", new Date().toISOString())
      .order("preferredDateTime", { referencedTable: "appointments", ascending: false })
      .limit(1, { referencedTable: "appointments" });
    if (patientsError) throw patientsError;

    if (patients.length === 0) {
      await delay(200 + Math.random() * 200);
      return NextResponse.json({ success: true, status: "new" as PhoneCheckStatus, patients: [] });
    }

    const maskedPatients: MaskedPatient[] = patients.map((p) => {
      const hasPending = p.appointments.length > 0;
      return {
        id: generatePatientToken(p.id),
        maskedName: maskName(p.name),
        hasPending,
        pendingDate: hasPending ? utcIso(p.appointments[0].preferredDateTime) : null,
      };
    });

    const hasAnyPending = maskedPatients.some((p) => p.hasPending);
    const status: PhoneCheckStatus = hasAnyPending ? "has_pending" : "existing";

    await delay(200 + Math.random() * 200);

    return NextResponse.json({ success: true, status, patients: maskedPatients });
  } catch (error) {
    console.error("GET /api/phone-check error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
