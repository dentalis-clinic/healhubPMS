import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@supabase/supabase-js";

interface Admin {
  id: string;
  clinicId: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Clinic {
  id: string;
  shortName: string;
  timezone: string;
}

type RequireAdminSuccess = { admin: Admin; clinic: Clinic; user: User; error: null };
type RequireAdminError = { admin: null; clinic: null; user: null; error: NextResponse };

type RequireAdminResult = RequireAdminSuccess | RequireAdminError;

/**
 * Authenticate and authorize the current request as an admin user.
 * Returns the admin, their clinic context, and Supabase user on success,
 * or a ready-to-return NextResponse on failure (401 or 403).
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      admin: null,
      clinic: null,
      user: null,
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  const admin = await prisma.admin.findUnique({
    where: { id: user.id },
    include: { clinic: { select: { id: true, shortName: true, timezone: true } } },
  });

  if (!admin) {
    return {
      admin: null,
      clinic: null,
      user: null,
      error: NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      ),
    };
  }

  return { admin, clinic: admin.clinic, user, error: null };
}
