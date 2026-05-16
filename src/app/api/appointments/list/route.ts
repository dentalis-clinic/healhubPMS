import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import type {
  AppointmentStatus,
  VisitType,
  BookingChannel,
} from "@/generated/prisma/client";

const PAGE_SIZE_DEFAULT = 30;
const PAGE_SIZE_MAX = 100;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const { clinic } = auth;

    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const statusFilter = searchParams.get("status") ?? "";
    const typeFilter = searchParams.get("type") ?? "";
    const dateFilter = searchParams.get("dateFilter") ?? "all";
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      PAGE_SIZE_MAX,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? String(PAGE_SIZE_DEFAULT), 10))
    );

    const allowedSortColumns: Record<string, Record<string, string>> = {
      createdAt: { createdAt: sortOrder },
      preferredDateTime: { preferredDateTime: sortOrder },
      status: { status: sortOrder },
    };
    const orderBy = allowedSortColumns[sortBy] ?? { createdAt: sortOrder };

    const where: Record<string, unknown> = { clinicId: clinic.id };

    if (dateFilter === "today" || dateFilter === "upcoming") {
      const now = DateTime.now().setZone(clinic.timezone);
      const todayStart = now.startOf("day").toJSDate();
      const tomorrowStart = now.plus({ days: 1 }).startOf("day").toJSDate();

      if (dateFilter === "today") {
        where.preferredDateTime = { gte: todayStart, lt: tomorrowStart };
      } else {
        where.preferredDateTime = { gte: tomorrowStart };
        where.status = { not: "CANCELLED" as AppointmentStatus };
      }
    }

    if (statusFilter) {
      where.status = statusFilter as AppointmentStatus;
    }

    if (typeFilter === "FOLLOW_UP") {
      where.visitType = "FOLLOW_UP" as VisitType;
    } else if (typeFilter === "ONLINE") {
      where.bookingChannel = "ONLINE" as BookingChannel;
    } else if (typeFilter === "WALK_IN") {
      where.bookingChannel = "WALK_IN" as BookingChannel;
    }

    if (q) {
      where.OR = [
        { patient: { name: { contains: q, mode: "insensitive" } } },
        { patient: { phone: { contains: q } } },
        { patient: { patientId: { contains: q, mode: "insensitive" } } },
      ];
    }

    const include = {
      patient: true,
      prescription: { select: { id: true, prescriptionId: true } },
      doctor: { select: { id: true, name: true, qualifications: true } },
      payments: { select: { amount: true, method: true } },
    } as const;

    const [total, appointments] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include,
        orderBy,
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
    ]);

    const serialized = appointments.map((a) => {
      const totalPaid = a.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      const isWaived = a.payments.some((p) => p.method === "WAIVED");
      return {
        ...a,
        isWaived,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        preferredDateTime: a.preferredDateTime.toISOString(),
        totalAmount: a.totalAmount != null ? Number(a.totalAmount) : null,
        totalPaid,
        payments: undefined,
        patient: {
          ...a.patient,
          createdAt: a.patient.createdAt.toISOString(),
          updatedAt: a.patient.updatedAt.toISOString(),
        },
        prescription: a.prescription ?? null,
        doctor: a.doctor ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      appointments: serialized,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("GET /api/appointments/list error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
