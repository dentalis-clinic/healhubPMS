import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { withUtcTimestamps } from "@/lib/supabase/serialize";
import { z } from "zod/v4";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  templateType: z.enum(["DOCUMENT", "SURVEY"]).optional().default("DOCUMENT"),
  showPatientDetails: z.boolean(),
  content: z.string(),
});

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { data: templates, error } = await createAdminClient()
      .from("printable_templates")
      .select("id, title, templateType, showPatientDetails, createdAt, updatedAt")
      .eq("clinicId", clinic.id)
      .order("createdAt", { ascending: true });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      templates: templates.map((t) => withUtcTimestamps(t)),
    });
  } catch (error) {
    console.error("GET /api/printable-templates error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch templates" }, { status: 500 });
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
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const { data: template, error } = await createAdminClient()
      .from("printable_templates")
      .insert({ id: crypto.randomUUID(), clinicId: clinic.id, ...parsed.data, updatedAt: now })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ success: true, template: withUtcTimestamps(template) });
  } catch (error) {
    console.error("POST /api/printable-templates error:", error);
    return NextResponse.json({ success: false, error: "Failed to create template" }, { status: 500 });
  }
}
