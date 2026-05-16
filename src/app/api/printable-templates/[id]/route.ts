import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { validateOrigin } from "@/lib/utils/csrf";
import { z } from "zod/v4";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { id } = await params;
    const template = await prisma.printable_templates.findUnique({
      where: { id, clinicId: clinic.id },
    });

    if (!template) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("GET /api/printable-templates/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch template" }, { status: 500 });
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  templateType: z.enum(["DOCUMENT", "SURVEY"]).optional(),
  showPatientDetails: z.boolean().optional(),
  content: z.string().optional(),
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

    const existing = await prisma.printable_templates.findUnique({
      where: { id, clinicId: clinic.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: z.prettifyError(parsed.error) },
        { status: 400 }
      );
    }

    const template = await prisma.printable_templates.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("PATCH /api/printable-templates/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to update template" }, { status: 500 });
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

    const existing = await prisma.printable_templates.findUnique({
      where: { id, clinicId: clinic.id },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Template not found" }, { status: 404 });
    }

    await prisma.printable_templates.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/printable-templates/[id] error:", error);
    return NextResponse.json({ success: false, error: "Failed to delete template" }, { status: 500 });
  }
}
