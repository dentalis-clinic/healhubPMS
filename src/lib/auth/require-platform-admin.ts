import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/generated/supabase/database.types";

type PlatformAdmin = Pick<Tables<"platform_admins">, "id" | "email" | "name">;

type RequirePlatformAdminResult =
  | { platformAdmin: PlatformAdmin; user: User; error: null }
  | { platformAdmin: null; user: null; error: NextResponse };

/**
 * Look up the signed-in user's platform_admins row.
 * Returns null when nobody is signed in or the user isn't a platform admin
 * (a clinic admin's session is not enough). Real DB errors throw.
 */
export async function getPlatformAdmin(): Promise<{ platformAdmin: PlatformAdmin; user: User } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: platformAdmin, error } = await createAdminClient()
    .from("platform_admins")
    .select("id, email, name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!platformAdmin) return null;

  return { platformAdmin, user };
}

/**
 * API-route guard for /api/platform/*. Platform admins act across clinics, so
 * these routes never read x-clinic-id — every query names its clinic explicitly.
 */
export async function requirePlatformAdmin(): Promise<RequirePlatformAdminResult> {
  const result = await getPlatformAdmin();
  if (!result) {
    return {
      platformAdmin: null,
      user: null,
      error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ...result, error: null };
}
