import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/env";
import type { TablesUpdate } from "@/generated/supabase/database.types";

const patchAdminSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  email: z.string().trim().email("Invalid email address").optional(),
});

// --- PATCH: Update admin name/email ---
export async function PATCH(
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

    const body = await request.json();
    const parsed = patchAdminSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { name, email } = parsed.data;

    if (!name && !email) {
      return NextResponse.json(
        { success: false, error: "No fields to update." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: target, error: targetError } = await supabase
      .from("admins")
      .select("id, email")
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

    // If email changes, check for duplicates and update Supabase auth
    if (email && email !== target.email) {
      const { data: duplicate, error: duplicateError } = await supabase
        .from("admins")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: "An admin with this email already exists." },
          { status: 409 }
        );
      }

      const supabaseAdmin = createClient(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );

      const { error: authError } =
        await supabaseAdmin.auth.admin.updateUserById(id, { email });

      if (authError) {
        console.error("Admin email update auth error:", authError.message);
        return NextResponse.json(
          { success: false, error: "Failed to update admin email." },
          { status: 400 }
        );
      }
    }

    const updateData: TablesUpdate<"admins"> = { updatedAt: new Date().toISOString() };
    if (name) updateData.name = name;
    if (email && email !== target.email) updateData.email = email;

    const { data: updated, error: updateError } = await supabase
      .from("admins")
      .update(updateData)
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      admin: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
      },
    });
  } catch (error) {
    console.error("PATCH /api/admin/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

// --- DELETE: Remove admin ---
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { user, clinic } = auth;

    const { id } = await params;

    // Cannot delete yourself
    if (user.id === id) {
      return NextResponse.json(
        { success: false, error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Cannot delete last admin in this clinic
    const { count: adminCount, error: countError } = await supabase
      .from("admins")
      .select("id", { count: "exact", head: true })
      .eq("clinicId", clinic.id);
    if (countError) throw countError;
    if ((adminCount ?? 0) <= 1) {
      return NextResponse.json(
        { success: false, error: "Cannot delete the last admin." },
        { status: 400 }
      );
    }

    const { data: target, error: targetError } = await supabase
      .from("admins")
      .select("id")
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

    // Check if admin has prescribed any treatments
    const { count: prescriptionCount, error: prescriptionError } = await supabase
      .from("prescriptions")
      .select("id", { count: "exact", head: true })
      .eq("prescribedById", id);
    if (prescriptionError) throw prescriptionError;
    if (prescriptionCount && prescriptionCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete admin who has prescribed treatments. Reassign prescriptions first.",
        },
        { status: 409 }
      );
    }

    // Delete Supabase auth first (harder to recover), then the admins row
    const supabaseAdmin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await supabaseAdmin.auth.admin.deleteUser(id);

    const { error: deleteError } = await supabase.from("admins").delete().eq("id", id);
    if (deleteError) {
      // Auth user already deleted — log warning but don't fail
      console.warn("Supabase auth user deleted but admins row removal failed:", deleteError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
