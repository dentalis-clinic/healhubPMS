import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugSchema } from "@/lib/validations/onboarding";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";

  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return NextResponse.json({
      available: false,
      valid: false,
      message: parsed.error.issues[0]?.message ?? "Invalid slug",
    });
  }

  const { data: existing, error } = await createAdminClient()
    .from("clinics")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;

  if (existing) {
    return NextResponse.json({
      available: false,
      valid: true,
      message: "This subdomain is already taken",
    });
  }

  return NextResponse.json({ available: true, valid: true });
}
