import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { withUtcTimestamps } from "@/lib/supabase/serialize";

const createDoctorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  qualifications: z.string().trim().max(500).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "true";

    let query = createAdminClient().from("doctors").select().eq("clinicId", clinic.id);
    if (!includeInactive) query = query.eq("isActive", true);

    const { data: doctors, error } = await query.order("createdAt", { ascending: true });
    if (error) throw error;

    return NextResponse.json({ success: true, doctors: doctors.map((d) => withUtcTimestamps(d)) });
  } catch (error) {
    console.error("GET /api/doctors error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const body = await request.json();
    const parsed = createDoctorSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { name, qualifications, registrationNumber } = parsed.data;

    const { data: doctor, error } = await createAdminClient()
      .from("doctors")
      .insert({
        id: crypto.randomUUID(),
        clinicId: clinic.id,
        name,
        qualifications: qualifications || null,
        registrationNumber: registrationNumber || null,
        updatedAt: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json(
      {
        success: true,
        doctor: withUtcTimestamps(doctor),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/doctors error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
