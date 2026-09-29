import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/env";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;

    // Pre-existing gap fixed during conversion: the Prisma version looked up
    // `id` with no clinicId filter, letting any admin trigger a password-reset
    // email for another clinic's admin.
    const { data: target, error: targetError } = await createAdminClient()
      .from("admins")
      .select("email")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      return NextResponse.json(
        { success: false, error: "Admin not found." },
        { status: 404 }
      );
    }

    const supabaseAdmin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(
      target.email
    );

    if (error) {
      console.error("Password reset error:", error.message);
      return NextResponse.json(
        { success: false, error: "Failed to send password reset email." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset email sent.",
    });
  } catch (error) {
    console.error("POST /api/admin/[id]/reset-password error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
