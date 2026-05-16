import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const skip = (page - 1) * limit;

    const where = search
      ? {
          clinicId: clinic.id,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { phone: { contains: search } },
            { patientId: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : { clinicId: clinic.id };

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          patientId: true,
          name: true,
          phone: true,
          email: true,
          age: true,
          sex: true,
          address: true,
          createdAt: true,
          _count: { select: { appointments: true } },
          appointments: {
            orderBy: { preferredDateTime: "desc" },
            take: 1,
            select: { preferredDateTime: true },
          },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    const result = patients.map((p) => ({
      id: p.id,
      patientId: p.patientId,
      name: p.name,
      phone: p.phone,
      email: p.email,
      age: p.age,
      sex: p.sex,
      address: p.address,
      createdAt: p.createdAt.toISOString(),
      totalVisits: p._count.appointments,
      lastVisit:
        p.appointments.length > 0
          ? p.appointments[0].preferredDateTime.toISOString()
          : null,
    }));

    return NextResponse.json({ success: true, patients: result, total, page, limit });
  } catch (error) {
    console.error("GET /api/patients error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch patients" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const body = await request.json();
    const ids: unknown = body.ids;

    if (!Array.isArray(ids) || ids.length === 0 || ids.some((id) => typeof id !== "string")) {
      return NextResponse.json(
        { success: false, error: "ids must be a non-empty array of strings" },
        { status: 400 }
      );
    }

    const patientIds = ids as string[];

    await prisma.$transaction(async (tx) => {
      // Only delete patients belonging to this clinic
      const patients = await tx.patient.findMany({
        where: { clinicId: clinic.id, id: { in: patientIds } },
        select: { id: true },
      });
      const safePatientIds = patients.map((p) => p.id);

      if (safePatientIds.length === 0) return;

      const appointments = await tx.appointment.findMany({
        where: { patientId: { in: safePatientIds } },
        select: { id: true },
      });
      const appointmentIds = appointments.map((a) => a.id);

      if (appointmentIds.length > 0) {
        await tx.prescription.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
        await tx.payment.deleteMany({ where: { appointmentId: { in: appointmentIds } } });
        await tx.appointment.deleteMany({ where: { patientId: { in: safePatientIds } } });
      }

      await tx.patient.deleteMany({ where: { id: { in: safePatientIds } } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, deleted: patientIds.length });
  } catch (error) {
    console.error("DELETE /api/patients error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
