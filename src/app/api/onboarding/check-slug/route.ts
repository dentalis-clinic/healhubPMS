import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugSchema } from "@/lib/validations/onboarding";

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("slug") ?? "";

  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) {
    return NextResponse.json({
      available: false,
      valid: false,
      message: parsed.error.issues[0]?.message ?? "Invalid slug",
    });
  }

  const existing = await prisma.clinic.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json({
      available: false,
      valid: true,
      message: "This subdomain is already taken",
    });
  }

  return NextResponse.json({ available: true, valid: true });
}
