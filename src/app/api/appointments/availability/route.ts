/**
 * Appointment Availability API
 * GET /api/appointments/availability?date=YYYY-MM-DD&excludeAppointmentId=UUID
 *
 * Returns available and booked time slots for a given date.
 */

import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@/generated/prisma/client";
import { generateSlotsForDate } from "@/lib/utils/time-slots";
import { BUSINESS_HOURS_CONFIG } from "@/lib/config/business-hours";
import { createClient } from "@/lib/supabase/server";
import { getClinicContext } from "@/lib/utils/clinic-context";

export interface TimeSlotAvailability {
  time: string;
  datetime: string;
  available: boolean;
  count: number;
}

export interface AvailabilityResponse {
  success: boolean;
  date: string;
  slots: TimeSlotAvailability[];
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { clinic, error } = getClinicContext(request);
    if (error) return error;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const isAdmin = user
      ? !!(await prisma.admin.findUnique({ where: { id: user.id, clinicId: clinic.clinicId } }))
      : false;

    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");
    const excludeAppointmentId = searchParams.get("excludeAppointmentId");

    if (!dateParam) {
      return NextResponse.json(
        { success: false, error: "Date parameter is required (format: YYYY-MM-DD)" } as AvailabilityResponse,
        { status: 400 }
      );
    }

    const date = DateTime.fromISO(dateParam, { zone: BUSINESS_HOURS_CONFIG.timezone });

    if (!date.isValid) {
      return NextResponse.json(
        { success: false, error: `Invalid date format. Expected YYYY-MM-DD, got: ${dateParam}` } as AvailabilityResponse,
        { status: 400 }
      );
    }

    const slots = generateSlotsForDate(date);
    const startOfDay = date.startOf("day").toJSDate();
    const endOfDay = date.endOf("day").toJSDate();

    const whereClause: {
      clinicId: string;
      preferredDateTime: { gte: Date; lte: Date };
      status: { in: AppointmentStatus[] };
      id?: { not: string };
    } = {
      clinicId: clinic.clinicId,
      preferredDateTime: { gte: startOfDay, lte: endOfDay },
      status: { in: ["PENDING", "OVERDUE", "CONFIRMED", "COMPLETED"] },
    };

    if (excludeAppointmentId) {
      whereClause.id = { not: excludeAppointmentId };
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      select: { id: true, preferredDateTime: true },
    });

    const slotCountMap = new Map<string, number>();
    for (const appointment of appointments) {
      const appointmentTime = DateTime.fromJSDate(appointment.preferredDateTime, {
        zone: BUSINESS_HOURS_CONFIG.timezone,
      }).toFormat("HH:mm");
      slotCountMap.set(appointmentTime, (slotCountMap.get(appointmentTime) || 0) + 1);
    }

    const slotsWithAvailability: TimeSlotAvailability[] = slots.map((slot) => {
      const count = slotCountMap.get(slot.time) || 0;
      return {
        time: slot.time,
        datetime: slot.datetime,
        count: isAdmin ? count : 0,
        available: count === 0,
      };
    });

    return NextResponse.json({ success: true, date: dateParam, slots: slotsWithAvailability } as AvailabilityResponse);
  } catch (error) {
    console.error("Error fetching appointment availability:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch appointment availability. Please try again." } as AvailabilityResponse,
      { status: 500 }
    );
  }
}
