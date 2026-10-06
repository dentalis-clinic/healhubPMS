import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcIso } from "@/lib/supabase/serialize";
import { createClinicAdminSchema } from "@/lib/validations/platform";

type Params = { params: Promise<{ id: string }> };

// --- GET: a clinic's admin accounts ---
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const { id } = await params;
    const { data: admins, error } = await createAdminClient()
      .from("admins")
      .select("id, name, email, createdAt")
      .eq("clinicId", id)
      .order("createdAt", { ascending: true });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      admins: admins.map((a) => ({ ...a, createdAt: utcIso(a.createdAt) })),
    });
  } catch (error) {
    console.error("GET /api/platform/clinics/[id]/admins error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

// --- POST: add an admin to a clinic (auth user + admins row) ---
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requirePlatformAdmin();
    if (auth.error) return auth.error;

    const { id: clinicId } = await params;
    const parsed = createClinicAdminSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }
    const { name, email, password } = parsed.data;
    const supabase = createAdminClient();

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .select("id")
      .eq("id", clinicId)
      .maybeSingle();
    if (clinicError) throw clinicError;
    if (!clinic) {
      return NextResponse.json({ success: false, error: "Clinic not found." }, { status: 404 });
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (authError || !authData.user) {
      // Most commonly: the email already has an account (clinic admin or platform admin).
      return NextResponse.json(
        { success: false, error: authError?.message ?? "Failed to create the account." },
        { status: 409 }
      );
    }

    const { data: admin, error: insertError } = await supabase
      .from("admins")
      .insert({
        id: authData.user.id,
        clinicId,
        email,
        name,
        updatedAt: new Date().toISOString(),
      })
      .select("id, name, email, createdAt")
      .single();
    if (insertError) {
      // Undo the auth user so the email isn't left stranded.
      await supabase.auth.admin.deleteUser(authData.user.id).catch(() => {});
      throw insertError;
    }

    console.info(`[platform] ${auth.platformAdmin.email} added admin ${admin.id} to clinic ${clinicId}`);
    return NextResponse.json(
      { success: true, admin: { ...admin, createdAt: utcIso(admin.createdAt) } },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/platform/clinics/[id]/admins error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
