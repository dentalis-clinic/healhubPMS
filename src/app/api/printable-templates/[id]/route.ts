import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { withUtcTimestamps } from "@/lib/supabase/serialize";
import { z } from "zod/v4";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;
    const { data: template, error } = await createAdminClient()
      .from("printable_templates")
      .select()
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (error) throw error;

    if (!template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, template: withUtcTimestamps(template) });
  } catch (error) {
    console.error("GET /api/printable-templates/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch template" }, { status: 500 });
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  templateType: z.enum(["DOCUMENT", "SURVEY"]).optional(),
  showPatientDetails: z.boolean().optional(),
  content: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("printable_templates")
      .select("id")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const { data: template, error: updateError } = await supabase
      .from("printable_templates")
      .update({ ...parsed.data, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, template: withUtcTimestamps(template) });
  } catch (error) {
    console.error("PATCH /api/printable-templates/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("printable_templates")
      .select("id")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("printable_templates")
      .delete()
      .eq("id", id)
      .eq("clinicId", clinic.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/printable-templates/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete template" }, { status: 500 });
  }
}
