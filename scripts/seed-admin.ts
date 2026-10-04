import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@dentalis.com";
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME || "Admin";

  if (!password) {
    console.error(
      "SEED_ADMIN_PASSWORD is required. Set it in .env or pass via environment:\n" +
      "  SEED_ADMIN_PASSWORD=your_secure_password npx tsx scripts/seed-admin.ts"
    );
    process.exit(1);
  }

  // The first admin must belong to an existing clinic. Create the clinic first
  // (via /register, or a row in `clinics`), then pass its slug here.
  const clinicSlug = process.env.SEED_CLINIC_SLUG || "ddcj";
  const { data: clinic, error: clinicError } = await supabase
    .from("clinics")
    .select("id")
    .eq("slug", clinicSlug)
    .maybeSingle();
  if (clinicError) throw clinicError;
  if (!clinic) {
    console.error(`No clinic with slug "${clinicSlug}". Create it first, or set SEED_CLINIC_SLUG.`);
    process.exit(1);
  }

  // Check if admin already exists in our table
  const { data: existing, error: existingError } = await supabase
    .from("admins")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    console.log(`Admin with email "${email}" already exists. Skipping.`);
    return;
  }

  // Create user in Supabase Auth (or fetch existing)
  let userId: string;
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

  if (authError) {
    // User may already exist in Supabase Auth (e.g. after DB reset)
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existingUser = listData?.users?.find((u) => u.email === email);
    if (!existingUser) {
      throw new Error(`Supabase Auth error: ${authError.message}`);
    }
    userId = existingUser.id;
    console.log(`Supabase Auth user already exists, reusing ID: ${userId}`);
  } else {
    userId = authData.user.id;
  }

  // Create matching admin record in our database
  const { data: admin, error: insertError } = await supabase
    .from("admins")
    .insert({
      id: userId, // Same UUID as Supabase auth.users
      clinicId: clinic.id,
      email,
      name,
      updatedAt: new Date().toISOString(),
    })
    .select("id, email, name")
    .single();
  if (insertError) throw insertError;

  console.log(`Admin created successfully:`);
  console.log(`  ID:    ${admin.id}`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Name:  ${admin.name}`);
  console.log(
    `\nAdmin seeded. Store the password securely — it cannot be retrieved later.`
  );
}

main().catch((e) => {
  console.error("Failed to seed admin:", e);
  process.exit(1);
});
