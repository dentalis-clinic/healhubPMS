import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { env } from "@/env";

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
    const { user, clinic } = auth;

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

    const target = await prisma.admin.findUnique({ where: { id, clinicId: clinic.id } });
    if (!target) {
      return NextResponse.json(
        { success: false, error: "Admin not found." },
        { status: 404 }
      );
    }

    // If email changes, check for duplicates and update Supabase auth
    if (email && email !== target.email) {
      const duplicate = await prisma.admin.findUnique({ where: { email } });
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

    const updated = await prisma.admin.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && email !== target.email && { email }),
      },
    });

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

    // Cannot delete last admin in this clinic
    const adminCount = await prisma.admin.count({ where: { clinicId: clinic.id } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { success: false, error: "Cannot delete the last admin." },
        { status: 400 }
      );
    }

    const target = await prisma.admin.findUnique({ where: { id, clinicId: clinic.id } });
    if (!target) {
      return NextResponse.json(
        { success: false, error: "Admin not found." },
        { status: 404 }
      );
    }

    // Check if admin has prescribed any treatments
    const prescriptionCount = await prisma.prescription.count({
      where: { prescribedById: id },
    });
    if (prescriptionCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Cannot delete admin who has prescribed treatments. Reassign prescriptions first.",
        },
        { status: 409 }
      );
    }

    // Delete Supabase auth first (harder to recover), then Prisma record
    const supabaseAdmin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await supabaseAdmin.auth.admin.deleteUser(id);

    try {
      await prisma.admin.delete({ where: { id } });
    } catch (prismaError) {
      // Auth user already deleted — log warning but don't fail
      console.warn("Supabase auth user deleted but Prisma record removal failed:", prismaError);
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
