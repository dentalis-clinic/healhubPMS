import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { patchPatientSchema } from "@/lib/validations/appointment";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { validateOrigin } from "@/lib/utils/csrf";
import { Prisma } from "@/generated/prisma/client";

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

    const existing = await prisma.patient.findUnique({ where: { id, clinicId: clinic.id } });
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
    const updateData: Record<string, unknown> = {};
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

    const updated = await prisma.patient.update({ where: { id }, data: updateData });

    return NextResponse.json({
      success: true,
      patient: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
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

    const existing = await prisma.patient.findUnique({ where: { id, clinicId: clinic.id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Patient not found" },
        { status: 404 }
      );
    }

    await prisma.$transaction(async (tx) => {
      const appointments = await tx.appointment.findMany({
        where: { patientId: id },
        select: { id: true },
      });
      const appointmentIds = appointments.map((a) => a.id);

      if (appointmentIds.length > 0) {
        await tx.prescription.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
        await tx.payment.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
        await tx.appointment.deleteMany({ where: { patientId: id } });
      }

      await tx.patient.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/patients/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
