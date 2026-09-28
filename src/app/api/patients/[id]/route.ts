import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { patchPatientSchema } from "@/lib/validations/appointment";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { withUtcTimestamps } from "@/lib/supabase/serialize";
import type { TablesUpdate } from "@/generated/supabase/database.types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const { id } = await params;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;
    const supabase = createAdminClient();

    const { data: existing, error: existingError } = await supabase
      .from("patients")
      .select("id")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = patchPatientSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: TablesUpdate<"patients"> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.age !== undefined) updateData.age = data.age ?? null;
    if (data.sex !== undefined) updateData.sex = data.sex;

    if (data.phone !== undefined) {
      try {
        updateData.phone = normalizePhoneNumber(data.phone);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid phone number";
        return NextResponse.json({ success: false, error: message }, { status: 400 });
      }
    }

    // @updatedAt was set by Prisma client-side; the column has no DB default/trigger.
    const { data: updated, error: updateError } = await supabase
      .from("patients")
      .update({ ...updateData, updatedAt: new Date().toISOString() })
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, patient: withUtcTimestamps(updated) });
  } catch (error) {
    console.error("PATCH /api/patients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const { id } = await params;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    // Cascades appointments + their prescriptions/payments; clinic-scoped, so a
    // 0 count means the patient doesn't exist in this clinic.
    const { data: deleted, error } = await createAdminClient().rpc("delete_patients", {
      p_clinic_id: clinic.id,
      p_ids: [id],
    });
    if (error) throw error;
    if (deleted === 0) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/patients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
