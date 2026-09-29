import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { withUtcTimestamps } from "@/lib/supabase/serialize";
import type { TablesUpdate } from "@/generated/supabase/database.types";

const patchDoctorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200).optional(),
  qualifications: z.string().trim().max(500).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  isActive: z.boolean().optional(),
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

    const body = await request.json();
    const parsed = patchDoctorSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { name, qualifications, registrationNumber, isActive } = parsed.data;

    if (!name && !qualifications && registrationNumber === undefined && isActive === undefined) {
      return NextResponse.json(
        { success: false, error: "No fields to update." },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { data: target, error: targetError } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      return NextResponse.json(
        { success: false, error: "Doctor not found." },
        { status: 404 }
      );
    }

    const updateData: TablesUpdate<"doctors"> = { updatedAt: new Date().toISOString() };
    if (name) updateData.name = name;
    if (qualifications !== undefined) updateData.qualifications = qualifications || null;
    if (registrationNumber !== undefined) updateData.registrationNumber = registrationNumber || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const { data: updated, error: updateError } = await supabase
      .from("doctors")
      .update(updateData)
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .select()
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      doctor: withUtcTimestamps(updated),
    });
  } catch (error) {
    console.error("PATCH /api/doctors/[id] error:", error);
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

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: target, error: targetError } = await supabase
      .from("doctors")
      .select("id")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      return NextResponse.json(
        { success: false, error: "Doctor not found." },
        { status: 404 }
      );
    }

    const { count: appointmentCount, error: countError } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("clinicId", clinic.id)
      .eq("doctorId", id);
    if (countError) throw countError;

    if (appointmentCount && appointmentCount > 0) {
      const { error: deactivateError } = await supabase
        .from("doctors")
        .update({ isActive: false, updatedAt: new Date().toISOString() })
        .eq("id", id)
        .eq("clinicId", clinic.id);
      if (deactivateError) throw deactivateError;
    } else {
      const { error: deleteError } = await supabase
        .from("doctors")
        .delete()
        .eq("id", id)
        .eq("clinicId", clinic.id);
      if (deleteError) throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/doctors/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
