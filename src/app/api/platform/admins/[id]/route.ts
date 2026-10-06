import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { setAdminPasswordSchema } from "@/lib/validations/platform";

type Params = { params: Promise<{ id: string }> };

// Only clinic admins are managed here — never platform admins (seed script only).
async function findClinicAdmin(id: string) {
  const { data, error } = await createAdminClient()
    .from("admins")
    .select("id, clinicId, email")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// --- PATCH: set a temporary password (no email delivery yet, so no reset links) ---
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const parsed = setAdminPasswordSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const target = await findClinicAdmin(id);
    if (!target) {
      return NextResponse.json({ success: false, error: "Admin not found." }, { status: 404 });
    }

    const { error } = await createAdminClient().auth.admin.updateUserById(id, {
      password: parsed.data.password,
    });
    if (error) throw error;

    console.info(`[platform] ${auth.platformAdmin.email} set a new password for admin ${id}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/platform/admins/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

// --- DELETE: remove a clinic admin (admins row, then their auth user) ---
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const target = await findClinicAdmin(id);
    if (!target) {
      return NextResponse.json({ success: false, error: "Admin not found." }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { count, error: countError } = await supabase
      .from("admins")
      .select("id", { count: "exact", head: true })
      .eq("clinicId", target.clinicId);
    if (countError) throw countError;
    if ((count ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: "A clinic must keep at least one admin. Add another admin first." },
        { status: 400 }
      );
    }

    // Row first: if their name is on appointments/prescriptions/payments the FK
    // rejects it and nothing has changed yet.
    const { error: deleteError } = await supabase.from("admins").delete().eq("id", id);
    if (deleteError) {
      if (deleteError.code === "23503") {
        return NextResponse.json(
          {
            success: false,
            error: "This admin has recorded appointments, prescriptions or payments, so they can't be removed. Set a new password instead to lock them out.",
          },
          { status: 409 }
        );
      }
      throw deleteError;
    }

    const { error: authError } = await supabase.auth.admin.deleteUser(id);
    if (authError) {
      // Row is gone, so the account can no longer reach any clinic — log and carry on.
      console.warn(`[platform] admins row ${id} removed but auth user delete failed:`, authError.message);
    }

    console.info(`[platform] ${auth.platformAdmin.email} removed admin ${id} from clinic ${target.clinicId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/platform/admins/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
