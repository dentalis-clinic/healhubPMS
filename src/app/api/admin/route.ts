import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { env } from "@/env";

const createAdminSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().trim().min(1, "Name is required").max(100),
});

// --- GET: List all admins ---
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { clinic } = auth;

    const admins = await prisma.admin.findMany({
      where: { clinicId: clinic.id },
      orderBy: { createdAt: "asc" },
    });

    const serialized = admins.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      createdAt: a.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, admins: serialized });
  } catch (error) {
    console.error("GET /api/admin error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

// --- POST: Create admin ---
export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    // Validate body
    const body = await request.json();
    const parsed = createAdminSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { email, password, name } = parsed.data;

    // Check if admin already exists
    const duplicate = await prisma.admin.findUnique({ where: { email } });
    if (duplicate) {
      return NextResponse.json(
        { success: false, error: "An admin with this email already exists." },
        { status: 409 }
      );
    }

    // Create Supabase auth user via service role client
    const supabaseAdmin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      console.error("Admin creation auth error:", authError.message);
      return NextResponse.json(
        { success: false, error: "Failed to create admin account." },
        { status: 400 }
      );
    }

    // Create matching admin record in our database (same clinic as requesting admin)
    try {
      const admin = await prisma.admin.create({
        data: {
          id: authData.user.id,
          clinicId: clinic.id,
          email,
          name,
        },
      });

      return NextResponse.json(
        {
          success: true,
          admin: { id: admin.id, email: admin.email, name: admin.name },
        },
        { status: 201 }
      );
    } catch (prismaError) {
      // Clean up: delete the orphaned Supabase auth user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error("Prisma admin creation failed, cleaned up auth user:", prismaError);
      return NextResponse.json(
        { success: false, error: "Failed to create admin record." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("POST /api/admin error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
