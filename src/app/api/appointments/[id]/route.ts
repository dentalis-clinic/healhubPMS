import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/auth/require-admin";
import { patchAppointmentSchema } from "@/lib/validations/appointment";
import { validateOrigin } from "@/lib/utils/csrf";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNotFound, isSlotConflict, slotConflictResponse, type AppointmentPatch } from "@/lib/supabase/rpc";
import { dateOnlyIso, utcIso, withUtcTimestamps } from "@/lib/supabase/serialize";
import type { Enums } from "@/generated/supabase/database.types";

type AppointmentStatus = Enums<"AppointmentStatus">;

/** Valid status transitions — terminal states have no outgoing edges. */
const VALID_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "OVERDUE", "CANCELLED"],
  OVERDUE: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  TENTATIVE: ["CONFIRMED", "CANCELLED"], // DEPRECATED: Keep for backward compatibility
};

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
      .from("appointments")
      .select("status")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Appointment not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = patchAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    if (data.status) {
      const allowed = VALID_TRANSITIONS[existing.status];
      if (!allowed.includes(data.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot transition from ${existing.status} to ${data.status}.`,
          },
          { status: 400 }
        );
      }
    }

    const updateData: AppointmentPatch = {};
    if (data.status !== undefined) updateData.status = data.status;
    if (data.bookingChannel !== undefined) updateData.bookingChannel = data.bookingChannel;
    if (data.visitType !== undefined) updateData.visitType = data.visitType;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.doctorId !== undefined) updateData.doctorId = data.doctorId ?? null;
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount ?? null;
    if (data.reasonForVisit !== undefined)
      updateData.reasonForVisit = data.reasonForVisit || null;
    if (data.notes !== undefined) updateData.notes = data.notes || null;
    if (data.preferredDateTime !== undefined)
      updateData.preferredDateTime = data.preferredDateTime.toISOString();

    // The RPC also runs the slot-conflict check when preferredDateTime is in the patch.
    const { error: rpcError } = await supabase.rpc("update_appointment_atomic", {
      p_clinic_id: clinic.id,
      p_id: id,
      p_data: updateData,
    });
    if (rpcError) {
      if (isSlotConflict(rpcError)) return slotConflictResponse();
      if (isNotFound(rpcError)) {
        return NextResponse.json(
          { success: false, error: "Appointment not found" },
          { status: 404 }
        );
      }
      throw rpcError;
    }

    const { data: updated, error: updatedError } = await supabase
      .from("appointments")
      .select("*, patient:patients(*), prescription:prescriptions(*)")
      .eq("id", id)
      .eq("clinicId", clinic.id)
      .single();
    if (updatedError) throw updatedError;

    const appointment = {
      ...withUtcTimestamps(updated),
      preferredDateTime: utcIso(updated.preferredDateTime),
      patient: withUtcTimestamps(updated.patient),
      prescription: updated.prescription
        ? {
            ...withUtcTimestamps(updated.prescription),
            nextVisitDate: dateOnlyIso(updated.prescription.nextVisitDate),
          }
        : null,
    };

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    console.error("PATCH /api/appointments/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
