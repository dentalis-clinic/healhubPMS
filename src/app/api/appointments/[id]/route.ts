import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { patchAppointmentSchema } from "@/lib/validations/appointment";
import { updateAppointmentAtomic, SlotConflictError } from "@/lib/utils/slot-conflict";
import { validateOrigin } from "@/lib/utils/csrf";
import type { AppointmentStatus } from "@/generated/prisma/client";

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

    const existing = await prisma.appointment.findUnique({
      where: { id, clinicId: clinic.id },
      include: { patient: true },
    });
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
      if (!allowed.includes(data.status as AppointmentStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: `Cannot transition from ${existing.status} to ${data.status}.`,
          },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, unknown> = {};
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
      updateData.preferredDateTime = data.preferredDateTime;

    const newDateTime = data.preferredDateTime instanceof Date
      ? data.preferredDateTime
      : data.preferredDateTime
        ? new Date(data.preferredDateTime as string)
        : undefined;

    const updated = await updateAppointmentAtomic(prisma, {
      clinicId: clinic.id,
      id,
      data: updateData,
      newPreferredDateTime: newDateTime,
    });

    const appointment = {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      preferredDateTime: updated.preferredDateTime.toISOString(),
      patient: {
        ...updated.patient,
        createdAt: updated.patient.createdAt.toISOString(),
        updatedAt: updated.patient.updatedAt.toISOString(),
        age: updated.patient.age,
      },
      prescription: updated.prescription
        ? {
            ...updated.prescription,
            createdAt: updated.prescription.createdAt.toISOString(),
            updatedAt: updated.prescription.updatedAt.toISOString(),
            nextVisitDate: updated.prescription.nextVisitDate?.toISOString() ?? null,
          }
        : null,
    };

    return NextResponse.json({ success: true, appointment });
  } catch (error) {
    if (error instanceof SlotConflictError) {
      return NextResponse.json(
        { success: false, error: error.message, code: "SLOT_CONFLICT" },
        { status: 409 }
      );
    }
    console.error("PATCH /api/appointments/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
