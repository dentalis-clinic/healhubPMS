/**
 * On-demand appointment status resolver.
 * Runs two indexed updateMany queries to transition time-based statuses:
 *   PENDING  + past appointment time          → OVERDUE
 *   CONFIRMED + past appointment time + buffer → COMPLETED
 *
 * Call at the start of any API that reads appointment data.
 * Idempotent — returns count: 0 instantly when nothing needs updating.
 *
 * Rate-limited: skips execution if last run was within RESOLVE_INTERVAL_MS.
 * Module-level state persists across requests on warm serverless instances.
 */

import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";

const RESOLVE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
let lastResolvedAt = 0;

export async function resolveAppointmentStatuses() {
  const ts = Date.now();
  if (ts - lastResolvedAt < RESOLVE_INTERVAL_MS) {
    return { overdue: 0, completed: 0 };
  }
  lastResolvedAt = ts;
  const now = DateTime.utc();
  // 30-min buffer is a cross-clinic default; per-clinic slot duration is a future improvement
  const bufferCutoff = now.minus({ minutes: 30 }).toJSDate();

  const [overdueResult, completedResult] = await Promise.all([
    // PENDING past appointment time → OVERDUE
    prisma.appointment.updateMany({
      where: {
        status: "PENDING",
        preferredDateTime: { lt: now.toJSDate() },
      },
      data: { status: "OVERDUE" },
    }),

    // CONFIRMED past appointment time + slot duration → COMPLETED
    prisma.appointment.updateMany({
      where: {
        status: "CONFIRMED",
        preferredDateTime: { lt: bufferCutoff },
      },
      data: { status: "COMPLETED" },
    }),
  ]);

  return {
    overdue: overdueResult.count,
    completed: completedResult.count,
  };
}
