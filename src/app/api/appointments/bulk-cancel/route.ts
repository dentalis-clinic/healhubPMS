import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { bulkCancelSchema } from "@/lib/validations/appointment";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const body = await request.json();
    const parsed = bulkCancelSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { ids } = parsed.data;

    const { data: cancelled, error } = await createAdminClient()
      .from("appointments")
      .update({ status: "CANCELLED", updatedAt: new Date().toISOString() })
      .eq("clinicId", clinic.id)
      .in("id", ids)
      .in("status", ["PENDING", "OVERDUE"])
      .select("id");
    if (error) throw error;

    const skipped = ids.length - cancelled.length;

    return NextResponse.json({ success: true, cancelled: cancelled.length, skipped });
  } catch (error) {
    console.error("PATCH /api/appointments/bulk-cancel error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
