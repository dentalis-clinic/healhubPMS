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
 * Signed in (authentication) and allowed in (authorization) are separate
 * outcomes: a signed-in user who isn't an admin must get a "no access" answer,
 * never the login page — middleware sends signed-in users away from
 * /admin/login, so that would loop.
 */
export type AdminAccess =
  | { status: "ok"; admin: Admin; clinic: Clinic; user: User }
  | { status: "signed_out" }
  | { status: "not_admin"; user: User }
  | { status: "clinic_inactive"; user: User };

/**
 * The single admin check shared by API routes (requireAdmin) and the
 * dashboard pages. Real DB errors throw.
 */
export async function getAdminAccess(): Promise<AdminAccess> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { status: "signed_out" };

  // maybeSingle: zero rows → data null; real DB errors still throw → caller's 500.
  const { data: row, error } = await createAdminClient()
    .from("admins")
    .select("id, clinicId, email, name, createdAt, updatedAt, clinic:clinics(id, shortName, timezone, isActive)")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!row) return { status: "not_admin", user };

  const { clinic: { isActive, ...clinic }, ...admin } = row;

  // A deactivated clinic (platform admin switched it off) loses API access too,
  // not just its pages — the middleware only hides the subdomain.
  if (!isActive) return { status: "clinic_inactive", user };

  return { status: "ok", admin, clinic, user };
}

const DENIED: Record<Exclude<AdminAccess["status"], "ok">, { error: string; status: number }> = {
  signed_out: { error: "Unauthorized", status: 401 },
  not_admin: { error: "Forbidden", status: 403 },
  clinic_inactive: { error: "This clinic has been deactivated.", status: 403 },
};

/**
 * Authenticate and authorize the current request as an admin user.
 * Returns the admin, their clinic context, and Supabase user on success,
 * or a ready-to-return NextResponse on failure (401 or 403).
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const access = await getAdminAccess();

  if (access.status !== "ok") {
    const { error, status } = DENIED[access.status];
    return {
      admin: null,
      clinic: null,
      user: null,
      error: NextResponse.json({ success: false, error }, { status }),
    };
  }

  const { admin, clinic, user } = access;
  return { admin, clinic, user, error: null };
}
