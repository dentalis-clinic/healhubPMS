import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcIso } from "@/lib/supabase/serialize";

// --- GET: every clinic with account/usage counts (no patient fields) ---
export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const { data, error } = await createAdminClient()
      .rpc("get_platform_clinic_overview")
      .order("createdAt", { ascending: false });
    if (error) throw error;

    const clinics = data.map((c) => ({
      ...c,
      createdAt: utcIso(c.createdAt),
      lastAppointmentAt: utcIso(c.lastAppointmentAt),
    }));

    return NextResponse.json({ success: true, clinics });
  } catch (error) {
    console.error("GET /api/platform/clinics error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
