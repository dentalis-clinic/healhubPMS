import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";

const businessHoursSessionSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
  end: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:mm"),
});

const addressSchema = z.object({
  line1: z.string().trim().min(1),
  line2: z.string().trim().optional().nullable(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  pincode: z.string().trim().min(1),
});

const patchClinicSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    shortName: z.string().trim().min(1).max(20).toUpperCase(),
    timezone: z.string().trim().min(1),
    address: addressSchema.nullable(),
    phones: z.array(z.string().trim().min(1)).max(5),
    email: z.string().trim().email().nullable(),
    website: z.string().trim().url().nullable(),
    businessHours: z.array(businessHoursSessionSchema).min(1).max(4),
    slotDuration: z.number().int().min(10).max(120),
  })
  .partial();

// GET — return current clinic settings
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const clinic = await prisma.clinic.findUnique({
      where: { id: auth.clinic.id },
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        timezone: true,
        address: true,
        phones: true,
        email: true,
        website: true,
        logo: true,
        businessHours: true,
        slotDuration: true,
        isActive: true,
      },
    });

    if (!clinic) {
      return NextResponse.json({ success: false, error: "Clinic not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, clinic });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to fetch settings" }, { status: 500 });
  }
}

// PATCH — update editable clinic fields
export async function PATCH(request: NextRequest) {
  try {
    const csrfError = validateOrigin(request);
    if (csrfError) return csrfError;

    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const body = await request.json();
    const result = patchClinicSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: z.prettifyError(result.error) },
        { status: 400 }
      );
    }

    const data = result.data;

    const updated = await prisma.clinic.update({
      where: { id: auth.clinic.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.shortName !== undefined && { shortName: data.shortName }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.address !== undefined && { address: data.address ?? undefined }),
        ...(data.phones !== undefined && { phones: data.phones }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.website !== undefined && { website: data.website }),
        ...(data.businessHours !== undefined && { businessHours: data.businessHours }),
        ...(data.slotDuration !== undefined && { slotDuration: data.slotDuration }),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        shortName: true,
        timezone: true,
        address: true,
        phones: true,
        email: true,
        website: true,
        logo: true,
        businessHours: true,
        slotDuration: true,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, clinic: updated });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to update settings" }, { status: 500 });
  }
}
