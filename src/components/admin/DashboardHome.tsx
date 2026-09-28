"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { formatISTDateTime } from "@/lib/utils/date";
import { STATUS_BADGE, TYPE_LABEL } from "@/lib/constants/appointment";
import { Badge, Button } from "@/components/ui";
import { useDashboard } from "./DashboardContext";
import type { DashboardStats } from "@/types/dashboard";
import type { AppointmentRow } from "@/types/patient";
import type { ApiJson } from "@/types/api";

const KPI_LABELS: { key: keyof DashboardStats; label: string; href: string }[] = [
  { key: "todayAppointments", label: "Today's Appointments", href: "/admin/dashboard/appointments?tab=today" },
  { key: "pendingConfirmations", label: "Pending Confirmations", href: "/admin/dashboard/appointments?status=PENDING" },
  { key: "patientsSeenToday", label: "Patients Seen Today", href: "/admin/dashboard/appointments?tab=today&status=COMPLETED" },
  { key: "totalPatients", label: "Total Patients", href: "/admin/dashboard/appointments?tab=all" },
];

interface DashboardHomeProps {
  initialStats: DashboardStats;
  initialAppointments: AppointmentRow[];
}

export default function DashboardHome({
  initialStats,
  initialAppointments,
}: DashboardHomeProps) {
  const { refreshKey, openConfirmAppointment, triggerRefresh } = useDashboard();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [appointments, setAppointments] =
    useState<AppointmentRow[]>(initialAppointments);
  const isFirstRender = useRef(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const handleMarkComplete = useCallback(async (appointmentId: string) => {
    setCompletingId(appointmentId);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) triggerRefresh();
    } catch {
      // silently fail, user can retry
    } finally {
      setCompletingId(null);
    }
  }, [triggerRefresh]);

  // Only refetch client-side when refreshKey changes (after mutations)
  const fetchData = useCallback(async () => {
    try {
      const [statsRes, appointmentsRes] = await Promise.all([
        fetch("/api/dashboard/stats"),
        fetch(
          "/api/appointments/list?dateFilter=today&sortBy=preferredDateTime&sortOrder=asc"
        ),
      ]);

      const [statsData, appointmentsData] = await Promise.all([
        statsRes.json() as Promise<ApiJson & { stats: DashboardStats }>,
        appointmentsRes.json() as Promise<ApiJson & { appointments: AppointmentRow[] }>,
      ]);

      if (statsData.success) setStats(statsData.stats);
      if (appointmentsData.success)
        setAppointments(appointmentsData.appointments);
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
    }
  }, []);

  useEffect(() => {
    // Skip the initial render — we already have server-fetched data
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchData();
  }, [fetchData, refreshKey]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPI_LABELS.map(({ key, label, href }) => (
          <Link
            key={key}
            href={href}
            className="rounded-lg border border-border-primary bg-surface-primary p-4 shadow-sm transition-colors hover:border-border-secondary hover:bg-surface-secondary"
          >
            <p className="text-sm font-medium text-text-hint">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-text-primary">
              {stats[key] ?? 0}
            </p>
          </Link>
        ))}
      </div>

      {/* Today's Appointments */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">
          Today&apos;s Appointments
        </h2>

        {appointments.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-hint">
            No appointments scheduled for today.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {appointments.map((a) => {
              const statusInfo = STATUS_BADGE[a.status];
              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-border-primary bg-surface-primary p-4 shadow-sm"
                >
                  {/* Header: patient info + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {a.patient.name}
                      </p>
                      <p className="text-xs text-text-hint">
                        {a.patient.patientId} &middot; {a.patient.phone}
                      </p>
                    </div>
                    <Badge variant={statusInfo.variant}>
                      {statusInfo.label}
                    </Badge>
                  </div>

                  {/* Time + type */}
                  <div className="mt-2 flex items-center gap-2 text-xs text-text-secondary">
                    <span>
                      {formatISTDateTime(new Date(a.preferredDateTime))}
                    </span>
                    <Badge variant="neutral">{a.type ? TYPE_LABEL[a.type] : "—"}</Badge>
                  </div>

                  {/* Reason */}
                  {a.reasonForVisit && (
                    <p className="mt-1 truncate text-xs text-text-tertiary">
                      {a.reasonForVisit}
                    </p>
                  )}

                  {/* Quick actions */}
                  <div className="mt-3 flex gap-2">
                    {(a.status === "PENDING" || a.status === "OVERDUE") && (
                      <Button
                        size="sm"
                        onClick={() => openConfirmAppointment(a)}
                      >
                        Confirm
                      </Button>
                    )}
                    {a.status === "CONFIRMED" && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleMarkComplete(a.id)}
                        disabled={completingId === a.id}
                      >
                        {completingId === a.id ? "..." : "Mark Complete"}
                      </Button>
                    )}
                    {(a.status === "CONFIRMED" ||
                      a.status === "COMPLETED") && (
                      <a
                        href={`/admin/dashboard/prescription/blank/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded border border-border-secondary px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                      >
                        Print Prescription
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
