import { PrismaClient, Prisma, type Sex } from "@/generated/prisma/client";
import { getClinicDate } from "./date";
import { normalizePhoneNumber } from "./phone";

const MAX_RETRIES = 3;

/** Transaction client type — PrismaClient minus interactive-tx-disallowed methods. */
export type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Generate a patient ID in the format {SHORTNAME}-YYYYMMDD-XXXX.
 * Must be called inside a serializable Prisma transaction.
 */
export async function generatePatientId(
  tx: TxClient,
  clinicId: string,
  clinicShortName: string,
  timezone: string,
  retryOffset = 0
): Promise<string> {
  const todayDate = getClinicDate(timezone);
  const prefix = `${clinicShortName}-${todayDate}`;

  const todayCount = await tx.patient.count({
    where: { clinicId, patientId: { startsWith: prefix } },
  });

  const serial = (todayCount + 1 + retryOffset).toString().padStart(4, "0");
  return `${prefix}-${serial}`;
}

/**
 * Generate an appointment ID in the format APT-YYYYMMDD-XXXX.
 * Must be called inside a serializable Prisma transaction.
 */
export async function generateAppointmentId(
  tx: TxClient,
  clinicId: string,
  timezone: string,
  retryOffset = 0
): Promise<string> {
  const todayDate = getClinicDate(timezone);
  const prefix = `APT-${todayDate}`;

  const todayCount = await tx.appointment.count({
    where: { clinicId, appointmentId: { startsWith: prefix } },
  });

  const serial = (todayCount + 1 + retryOffset).toString().padStart(4, "0");
  return `${prefix}-${serial}`;
}

/**
 * Find an existing patient by normalized phone + case-insensitive name within a clinic,
 * or create a new one with a generated clinic-scoped ID.
 */
export async function findOrCreatePatient(
  prisma: PrismaClient,
  data: {
    name: string;
    phone: string;
    email?: string | null;
    age?: number | null;
    sex?: Sex | null;
    address?: string | null;
  },
  clinic: { id: string; shortName: string; timezone: string }
): Promise<{ patientId: string; patient: { id: string; patientId: string }; isNew: boolean }> {
  const normalizedPhone = normalizePhoneNumber(data.phone);

  // Try to find existing patient by phone + name (case-insensitive) within this clinic
  const existing = await prisma.patient.findFirst({
    where: {
      clinicId: clinic.id,
      phone: normalizedPhone,
      name: { equals: data.name, mode: "insensitive" },
    },
  });

  if (existing) {
    const updates: Record<string, unknown> = {};
    if (data.email && !existing.email) updates.email = data.email;
    if (data.age != null && existing.age == null) updates.age = data.age;
    if (data.sex && !existing.sex) updates.sex = data.sex;
    if (data.address && !existing.address) updates.address = data.address;

    if (Object.keys(updates).length > 0) {
      await prisma.patient.update({ where: { id: existing.id }, data: updates });
    }

    return {
      patientId: existing.patientId,
      patient: { id: existing.id, patientId: existing.patientId },
      isNew: false,
    };
  }

  // Create new patient with generated clinic-scoped ID
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          const patientId = await generatePatientId(tx, clinic.id, clinic.shortName, clinic.timezone, attempt);
          const record = await tx.patient.create({
            data: {
              clinicId: clinic.id,
              patientId,
              name: data.name,
              phone: normalizedPhone,
              email: data.email || null,
              age: data.age ?? null,
              sex: data.sex || null,
              address: data.address || null,
            },
          });
          return { patientId, patient: { id: record.id, patientId } };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return { ...result, isNew: true };
    } catch (error: unknown) {
      const isUniqueViolation =
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002";

      if (isUniqueViolation && attempt < MAX_RETRIES - 1) continue;
      throw error;
    }
  }

  throw new Error("Failed to generate unique patient ID after max retries");
}
