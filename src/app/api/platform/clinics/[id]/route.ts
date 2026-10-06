import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateClinicStatusSchema } from "@/lib/validations/platform";

// --- PATCH: activate / deactivate a clinic ---
// Deactivated: its subdomain stops resolving (middleware) and its admins get
// 403 from every API (requireAdmin). No data is deleted; reactivating restores it.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = updateClinicStatusSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const { data: clinic, error } = await createAdminClient()
      .from("clinics")
      .update({ isActive: parsed.data.isActive, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .select("id, isActive")
      .maybeSingle();
    if (error) throw error;
    if (!clinic) {
      return NextResponse.json({ success: false, error: "Clinic not found." }, { status: 404 });
    }

    console.info(
      `[platform] ${auth.platformAdmin.email} set clinic ${clinic.id} isActive=${clinic.isActive}`
    );
    return NextResponse.json({ success: true, clinic });
  } catch (error) {
    console.error("PATCH /api/platform/clinics/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
