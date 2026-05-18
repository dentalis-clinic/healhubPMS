import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { confirmAppointmentSchema } from "@/lib/validations/appointment";
import { normalizePhoneNumber } from "@/lib/utils/phone";
import { findOrCreatePatient, generateAppointmentId } from "@/lib/utils/patient-id";
import { checkSlotConflict, SlotConflictError } from "@/lib/utils/slot-conflict";
import { validateOrigin } from "@/lib/utils/csrf";
import type { Sex } from "@/generated/prisma/client";

const MAX_APT_RETRIES = 3;

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  OVERDUE: ["CONFIRMED", "CANCELLED"],
  TENTATIVE: ["CONFIRMED", "CANCELLED"],
};

export async function POST(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { admin, clinic } = auth;

    const body = await request.json();
    const parsed = confirmAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const allowOverride = body.allowOverride === true;

    // Validate doctor exists, is active, and belongs to this clinic
    const doctor = await prisma.doctor.findUnique({
      where: { id: data.doctorId, clinicId: clinic.id, isActive: true },
    });
    if (!doctor) {
      return NextResponse.json(
        { success: false, error: "Selected doctor not found or inactive." },
        { status: 400 }
      );
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(data.phone);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid phone number";
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }

    // --- Flow A: Confirm existing PENDING/OVERDUE appointment ---
    if (data.existingAppointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: data.existingAppointmentId, clinicId: clinic.id },
        include: { patient: true },
      });

      if (!appointment) {
        return NextResponse.json(
          { success: false, error: "Appointment not found" },
          { status: 404 }
        );
      }

      if (!VALID_TRANSITIONS[appointment.status]?.includes("CONFIRMED")) {
        return NextResponse.json(
          { success: false, error: `Cannot confirm appointment with status "${appointment.status}"` },
          { status: 400 }
        );
      }

      const patientUpdates: Record<string, unknown> = {};
      if (data.name && data.name !== appointment.patient.name) patientUpdates.name = data.name;
      if (data.sex) patientUpdates.sex = data.sex as Sex;
      if (data.email) patientUpdates.email = data.email;
      if (data.address) patientUpdates.address = data.address;
      if (data.age != null) patientUpdates.age = data.age;

      const updated = await prisma.$transaction(
        async (tx) => {
          if (Object.keys(patientUpdates).length > 0) {
            await tx.patient.update({
              where: { id: appointment.patient.id },
              data: patientUpdates,
            });
          }

          if (!allowOverride) {
            await checkSlotConflict(tx, clinic.id, data.preferredDateTime, appointment.id);
          }

          return tx.appointment.update({
            where: { id: appointment.id },
            data: {
              status: "CONFIRMED",
              reasonForVisit: data.reasonForVisit || appointment.reasonForVisit,
              preferredDateTime: data.preferredDateTime,
              adminUserId: admin.id,
              doctorId: data.doctorId,
              totalAmount: data.totalAmount != null ? data.totalAmount : undefined,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      return NextResponse.json(
        {
          success: true,
          appointmentId: updated.id,
          patientId: appointment.patient.patientId,
          message: "Appointment confirmed.",
        },
        { status: 200 }
      );
    }

    // --- Flow B: New appointment for existing patient ---
    if (data.existingPatientId) {
      const patient = await prisma.patient.findUnique({
        where: { id: data.existingPatientId, clinicId: clinic.id },
      });

      if (!patient) {
        return NextResponse.json(
          { success: false, error: "Patient not found" },
          { status: 404 }
        );
      }

      const patientUpdates: Record<string, unknown> = {};
      if (data.sex) patientUpdates.sex = data.sex as Sex;
      if (data.email && !patient.email) patientUpdates.email = data.email;
      if (data.address && !patient.address) patientUpdates.address = data.address;
      if (data.age != null && patient.age == null) patientUpdates.age = data.age;

      if (Object.keys(patientUpdates).length > 0) {
        await prisma.patient.update({ where: { id: patient.id }, data: patientUpdates });
      }

      const appointmentType = data.visitType === "FOLLOW_UP" ? "FOLLOW_UP" : "WALK_IN";

      let appointment!: Awaited<ReturnType<typeof prisma.appointment.create>>;
      for (let attempt = 0; attempt < MAX_APT_RETRIES; attempt++) {
        try {
          appointment = await prisma.$transaction(
            async (tx) => {
              if (!allowOverride) {
                await checkSlotConflict(tx, clinic.id, data.preferredDateTime);
              }
              const appointmentId = await generateAppointmentId(tx, clinic.id, clinic.timezone, attempt);
              return tx.appointment.create({
                data: {
                  clinicId: clinic.id,
                  appointmentId,
                  patientId: patient.id,
                  type: appointmentType,
                  bookingChannel: data.isPhoneBooking ? "PHONE" : "WALK_IN",
                  visitType: data.visitType === "FOLLOW_UP" ? "FOLLOW_UP" : "NEW_CONSULTATION",
                  status: "CONFIRMED",
                  preferredDateTime: data.preferredDateTime,
                  reasonForVisit: data.reasonForVisit || null,
                  submittedBy: "ADMIN",
                  adminUserId: admin.id,
                  doctorId: data.doctorId,
                  totalAmount: data.totalAmount != null ? data.totalAmount : null,
                },
              });
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
          );
          break;
        } catch (err: unknown) {
          const isUniqueViolation =
            err instanceof Error && "code" in err && (err as { code: string }).code === "P2002";
          if (isUniqueViolation && attempt < MAX_APT_RETRIES - 1) continue;
          throw err;
        }
      }

      return NextResponse.json(
        {
          success: true,
          appointmentId: appointment.id,
          patientId: patient.patientId,
          message: "Appointment created and confirmed.",
        },
        { status: 201 }
      );
    }

    // --- Flow C: Brand new patient ---
    const { patientId, patient } = await findOrCreatePatient(
      prisma,
      {
        name: data.name,
        phone: normalizedPhone,
        email: data.email || null,
        age: data.age ?? null,
        sex: (data.sex as Sex) || null,
        address: data.address || null,
      },
      { id: clinic.id, shortName: clinic.shortName, timezone: clinic.timezone }
    );

    let appointment!: Awaited<ReturnType<typeof prisma.appointment.create>>;
    for (let attempt = 0; attempt < MAX_APT_RETRIES; attempt++) {
      try {
        appointment = await prisma.$transaction(
          async (tx) => {
            if (!allowOverride) {
              await checkSlotConflict(tx, clinic.id, data.preferredDateTime);
            }
            const appointmentId = await generateAppointmentId(tx, clinic.id, clinic.timezone, attempt);
            return tx.appointment.create({
              data: {
                clinicId: clinic.id,
                appointmentId,
                patientId: patient.id,
                type: "WALK_IN",
                bookingChannel: data.isPhoneBooking ? "PHONE" : "WALK_IN",
                visitType: "NEW_CONSULTATION",
                status: "CONFIRMED",
                preferredDateTime: data.preferredDateTime,
                reasonForVisit: data.reasonForVisit || null,
                submittedBy: "ADMIN",
                adminUserId: admin.id,
                doctorId: data.doctorId,
                totalAmount: data.totalAmount != null ? data.totalAmount : null,
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        break;
      } catch (err: unknown) {
        const isUniqueViolation =
          err instanceof Error && "code" in err && (err as { code: string }).code === "P2002";
        if (isUniqueViolation && attempt < MAX_APT_RETRIES - 1) continue;
        throw err;
      }
    }

    return NextResponse.json(
      {
        success: true,
        appointmentId: appointment.id,
        patientId,
        message: "Patient registered and appointment confirmed.",
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SlotConflictError) {
      return NextResponse.json(
        { success: false, error: error.message, code: "SLOT_CONFLICT" },
        { status: 409 }
      );
    }
    console.error("POST /api/appointments/confirm error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
