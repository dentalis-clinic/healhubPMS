import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";

const createDoctorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  qualifications: z.string().trim().max(500).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "true";

    const doctors = await prisma.doctor.findMany({
      where: includeInactive
        ? { clinicId: clinic.id }
        : { clinicId: clinic.id, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const serialized = doctors.map((d) => ({
      id: d.id,
      name: d.name,
      qualifications: d.qualifications,
      registrationNumber: d.registrationNumber,
      isActive: d.isActive,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));

    return NextResponse.json({ success: true, doctors: serialized });
  } catch (error) {
    console.error("GET /api/doctors error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
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
    const parsed = createDoctorSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.prettifyError(parsed.error);
      return NextResponse.json(
        { success: false, error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { name, qualifications, registrationNumber } = parsed.data;

    const doctor = await prisma.doctor.create({
      data: {
        clinicId: clinic.id,
        name,
        qualifications: qualifications || null,
        registrationNumber: registrationNumber || null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        doctor: {
          id: doctor.id,
          name: doctor.name,
          qualifications: doctor.qualifications,
          registrationNumber: doctor.registrationNumber,
          isActive: doctor.isActive,
          createdAt: doctor.createdAt.toISOString(),
          updatedAt: doctor.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/doctors error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
