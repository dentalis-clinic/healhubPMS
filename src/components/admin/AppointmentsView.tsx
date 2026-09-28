"use client";

import { useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { AppointmentRow } from "@/types/patient";
import PatientTable from "@/components/PatientTable";
import CSVExportButton from "@/components/CSVExportButton";
import { useDashboard } from "./DashboardContext";
import { Button, Input } from "@/components/ui";
import type { ApiJson } from "@/types/api";

type DateTab = "all" | "today" | "upcoming";
type StatusFilter = "" | "PENDING" | "CONFIRMED" | "OVERDUE";
type TypeFilter = "" | "ONLINE" | "WALK_IN" | "FOLLOW_UP";

const PAGE_SIZE = 30;

const TABS: { value: DateTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "OVERDUE", label: "Overdue" },
];

const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "ONLINE", label: "Online" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "FOLLOW_UP", label: "Follow-up" },
];

interface AppointmentsViewProps {
  initialAppointments: AppointmentRow[];
  initialTotal: number;
}

export default function AppointmentsView({
  initialAppointments,
  initialTotal,
}: AppointmentsViewProps) {
  const { refreshKey } = useDashboard();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const initialTab = (searchParams.get("tab") as DateTab) || "all";
  const initialStatus = (searchParams.get("status") as StatusFilter) || "";
  const initialType = (searchParams.get("type") as TypeFilter) || "";

  const [activeTab, setActiveTab] = useState<DateTab>(
    TABS.some((t) => t.value === initialTab) ? initialTab : "all"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    STATUS_OPTIONS.some((o) => o.value === initialStatus) ? initialStatus : ""
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>(
    TYPE_OPTIONS.some((o) => o.value === initialType) ? initialType : ""
  );
  const [search, setSearch] = useState("");
  const [appointments, setAppointments] = useState<AppointmentRow[]>(initialAppointments);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshKeyRef = useRef(refreshKey);

  const updateURL = useCallback(
    (tab: DateTab, status: StatusFilter, type: TypeFilter) => {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("tab", tab);
      if (status) params.set("status", status);
      if (type) params.set("type", type);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname]
  );

  // Core fetch — all params explicit, no stale closures.
  // `silent` skips the loading spinner so PatientTable stays mounted (preserves modal state).
  const fetchPage = useCallback(
    async (
      tab: DateTab,
      status: StatusFilter,
      type: TypeFilter,
      q: string,
      p: number,
      silent = false
    ) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (tab !== "all") params.set("dateFilter", tab);
        if (status) params.set("status", status);
        if (type) params.set("type", type);
        if (q.trim()) params.set("q", q.trim());
        params.set("page", String(p));
        params.set("pageSize", String(PAGE_SIZE));

        const res = await fetch(`/api/appointments/list?${params}`);
        const data = (await res.json()) as ApiJson & {
          appointments: AppointmentRow[];
          total: number;
        };
        if (data.success) {
          setAppointments(data.appointments);
          setTotal(data.total);
        }
      } catch (err) {
        console.error("Failed to fetch appointments:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // refreshKey changes (after mutations) — refetch current page
  if (refreshKey !== refreshKeyRef.current) {
    refreshKeyRef.current = refreshKey;
    fetchPage(activeTab, statusFilter, typeFilter, search, page);
  }

  const handleTabChange = (tab: DateTab) => {
    setActiveTab(tab);
    setPage(1);
    updateURL(tab, statusFilter, typeFilter);
    fetchPage(tab, statusFilter, typeFilter, search, 1);
  };

  const handleStatusChange = (status: StatusFilter) => {
    setStatusFilter(status);
    setPage(1);
    updateURL(activeTab, status, typeFilter);
    fetchPage(activeTab, status, typeFilter, search, 1);
  };

  const handleTypeChange = (type: TypeFilter) => {
    setTypeFilter(type);
    setPage(1);
    updateURL(activeTab, statusFilter, type);
    fetchPage(activeTab, statusFilter, type, search, 1);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setPage(1);
      fetchPage(activeTab, statusFilter, typeFilter, value, 1);
    }, 400);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchPage(activeTab, statusFilter, typeFilter, search, newPage);
  };

  const clearFilters = () => {
    setStatusFilter("");
    setTypeFilter("");
    setPage(1);
    updateURL(activeTab, "", "");
    fetchPage(activeTab, "", "", search, 1);
  };

  const hasActiveFilters = statusFilter !== "" || typeFilter !== "";
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented tabs */}
        <div className="inline-flex rounded-md border border-border-primary bg-surface-secondary p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-surface-primary text-text-primary shadow-sm"
                  : "text-text-hint hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-hint">
            <span className="font-medium text-text-secondary">{total}</span> total
          </span>
          <CSVExportButton appointments={appointments} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchPage(activeTab, statusFilter, typeFilter, search, page)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name, phone, or ID..."
          className="w-full sm:w-64"
        />

        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value as StatusFilter)}
          className="rounded-md border border-border-primary bg-surface-primary px-3 py-1.5 text-sm text-text-primary"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value as TypeFilter)}
          className="rounded-md border border-border-primary bg-surface-primary px-3 py-1.5 text-sm text-text-primary"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-text-hint hover:text-text-secondary"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-text-hint">
          Loading appointments...
        </div>
      ) : (
        <PatientTable
          appointments={appointments}
          onRefresh={() => fetchPage(activeTab, statusFilter, typeFilter, search, page, true)}
        />
      )}

      {/* Pagination footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          {total === 0
            ? "No appointments"
            : `Showing ${start}–${end} of ${total} appointment${total !== 1 ? "s" : ""}`}
          {search.trim() && ` matching "${search.trim()}"`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="rounded border border-border-primary px-2 py-1 text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40"
            >
              Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && (arr[idx - 1] as number) < p - 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "…" ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-text-hint">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => handlePageChange(p as number)}
                    className={`rounded border px-2.5 py-1 text-xs ${
                      page === p
                        ? "border-interactive-primary bg-interactive-primary text-text-inverse"
                        : "border-border-primary text-text-secondary hover:bg-surface-secondary"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              type="button"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="rounded border border-border-primary px-2 py-1 text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
