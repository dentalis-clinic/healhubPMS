import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { bulkDeleteSchema } from "@/lib/validations/appointment";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const body = await request.json();
    const parsed = bulkDeleteSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { ids } = parsed.data;

    const supabase = createAdminClient();
    const { data: deleted, error } = await supabase.rpc("bulk_delete_appointments", {
      p_clinic_id: clinic.id,
      p_ids: ids,
    });

    if (error) throw error;

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    console.error("DELETE /api/appointments/bulk-delete error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
