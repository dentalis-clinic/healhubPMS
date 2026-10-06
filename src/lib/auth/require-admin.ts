import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@supabase/supabase-js";
import type { Tables } from "@/generated/supabase/database.types";

// Timestamps are ISO strings (PostgREST), not Date — no caller reads them today.
type Admin = Pick<Tables<"admins">, "id" | "clinicId" | "email" | "name" | "createdAt" | "updatedAt">;
type Clinic = Pick<Tables<"clinics">, "id" | "shortName" | "timezone">;

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

  // maybeSingle: zero rows → data null (403 below); real DB errors still throw → caller's 500.
  const { data: row, error } = await createAdminClient()
    .from("admins")
    .select("id, clinicId, email, name, createdAt, updatedAt, clinic:clinics(id, shortName, timezone, isActive)")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (!row) {
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

  const { clinic: { isActive, ...clinic }, ...admin } = row;

  // A deactivated clinic (platform admin switched it off) loses API access too,
  // not just its pages — the middleware only hides the subdomain.
  if (!isActive) {
    return {
      admin: null,
      clinic: null,
      user: null,
      error: NextResponse.json(
        { success: false, error: "This clinic has been deactivated." },
        { status: 403 }
      ),
    };
  }

  return { admin, clinic, user, error: null };
}
