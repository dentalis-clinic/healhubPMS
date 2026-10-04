import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerClinicSchema } from "@/lib/validations/onboarding";

export async function POST(request: NextRequest) {
  // Track created resources for saga-style compensation on failure.
  let supabaseUserId: string | null = null;
  let clinicId: string | null = null;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const parsed = registerClinicSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Invalid input", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { clinic: clinicData, admin: adminData } = parsed.data;

    // Slug uniqueness — double-check here even though the wizard checks live.
    const { data: existingClinic, error: existingError } = await supabase
      .from("clinics")
      .select("id")
      .eq("slug", clinicData.slug)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existingClinic) {
      return NextResponse.json(
        { success: false, error: "This subdomain is already taken. Please choose another." },
        { status: 409 }
      );
    }

    // 1. Create Clinic row.
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({
        id: crypto.randomUUID(),
        slug: clinicData.slug,
        name: clinicData.name,
        shortName: clinicData.shortName,
        timezone: clinicData.timezone,
        address: clinicData.address ?? null,
        phones: clinicData.phones,
        email: clinicData.email || null,
        website: clinicData.website || null,
        logo: clinicData.logo || null,
        isActive: true,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();
    if (clinicError) throw clinicError;
    clinicId = clinic.id;

    // 2. Create Supabase auth user (email_confirm: true skips verification email).
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminData.email,
      password: adminData.password,
      email_confirm: true,
      user_metadata: { name: adminData.name },
    });

    if (authError || !authData.user) {
      throw new Error(authError?.message ?? "Failed to create admin account");
    }
    supabaseUserId = authData.user.id;

    // 3. Create Admin row linking the Supabase user to the clinic.
    const { error: adminError } = await supabase.from("admins").insert({
      id: supabaseUserId,
      clinicId: clinic.id,
      email: adminData.email,
      name: adminData.name,
      updatedAt: new Date().toISOString(),
    });
    if (adminError) throw adminError;

    return NextResponse.json({
      success: true,
      slug: clinicData.slug,
      clinicId: clinic.id,
    });
  } catch (error) {
    // Compensate: undo created resources in reverse order.
    if (supabaseUserId) {
      await supabase.auth.admin.deleteUser(supabaseUserId).catch(() => {});
    }
    if (clinicId) {
      // PostgrestBuilder is PromiseLike, not a full Promise — no .catch(); use try/catch.
      try {
        await supabase.from("clinics").delete().eq("id", clinicId);
      } catch {
        // best-effort compensation
      }
    }

    const message = error instanceof Error ? error.message : "Registration failed";
    console.error("[onboarding/register]", message);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
