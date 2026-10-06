import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/**
 * Create the super admin (platform admin) account. This is the ONLY way to
 * become one — there is deliberately no web UI for it.
 *
 *   PLATFORM_ADMIN_EMAIL=you@example.com \
 *   PLATFORM_ADMIN_PASSWORD='a-long-password' \
 *   PLATFORM_ADMIN_NAME='Your Name' \
 *   npx tsx scripts/seed-platform-admin.ts
 *
 * Use an email that is NOT a clinic admin: one login, one role.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Admin";

  if (!email || !password) {
    console.error("PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD are required (see the header of this file).");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Use a password of at least 12 characters — this account can switch off every clinic.");
    process.exit(1);
  }

  const { data: clinicAdmin, error: clinicAdminError } = await supabase
    .from("admins")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (clinicAdminError) throw clinicAdminError;
  if (clinicAdmin) {
    console.error(`"${email}" is already a clinic admin. Use a different email for the super admin.`);
    process.exit(1);
  }

  const { data: existing, error: existingError } = await supabase
    .from("platform_admins")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    console.log(`"${email}" is already a platform admin. Nothing to do.`);
    return;
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (authError || !authData.user) {
    throw new Error(
      `Could not create the auth user: ${authError?.message ?? "unknown error"}. ` +
        "If this email already has a login, pick another email."
    );
  }

  const { error: insertError } = await supabase.from("platform_admins").insert({
    id: authData.user.id,
    email,
    name,
  });
  if (insertError) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    throw insertError;
  }

  console.log(`Platform admin created: ${email}`);
  console.log("Sign in at <app URL>/platform/login. Store the password somewhere safe — it can't be retrieved.");
}

main().catch((e) => {
  console.error("Failed to seed platform admin:", e);
  process.exit(1);
});
