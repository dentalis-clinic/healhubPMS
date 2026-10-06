"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { formatISTDateTime } from "@/lib/utils/date";
import type { AppointmentRow, PatientRow } from "@/types/patient";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui/Button";
import { STATUS_BADGE, VISIT_TYPE_LABEL, PRIORITY_BADGE } from "@/lib/constants/appointment";
import { PatientDetailsModal } from "@/components/admin/PatientDetailsModal";
import { AppointmentDetailsModal } from "@/components/admin/AppointmentDetailsModal";
import { EditAppointmentModal } from "@/components/admin/EditAppointmentModal";

interface PatientTableProps {
  appointments: AppointmentRow[];
  onRefresh: () => void;
  highlightId?: string;
}

type SortKey = "name" | "preferredDateTime" | "status";

// --- Kebab Menu ---

function KebabMenu({
  appointment,
  onEdit,
  onRefresh,
  onComplete,
}: {
  appointment: AppointmentRow;
  onEdit: () => void;
  onRefresh: () => void;
  onComplete?: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<"cancel" | "delete" | null>(null);
  const [acting, setActing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  const { status } = appointment;
  const canComplete = status === "CONFIRMED";
  const canCancel = status === "PENDING" || status === "OVERDUE" || status === "CONFIRMED";
  const canDelete = status === "COMPLETED" || status === "CANCELLED";

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setConfirmingAction(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleCancel = useCallback(async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) { onRefresh(); setOpen(false); }
    } catch {
      // silently fail
    } finally {
      setActing(false);
      setConfirmingAction(null);
    }
  }, [appointment.id, onRefresh]);

  const handleDelete = useCallback(async () => {
    setActing(true);
    try {
      const res = await fetch("/api/appointments/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [appointment.id] }),
      });
      if (res.ok) { onRefresh(); setOpen(false); }
    } catch {
      // silently fail
    } finally {
      setActing(false);
      setConfirmingAction(null);
    }
  }, [appointment.id, onRefresh]);

  function toggleMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
    }
    setOpen((prev) => !prev);
    setConfirmingAction(null);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="rounded p-1 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
        aria-label="More actions"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M10 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM10 8.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM11.5 15.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-50 w-48 rounded-md border border-border-primary bg-surface-primary shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
        >
          {confirmingAction === null ? (
            <div className="py-1">
              {/* Edit — always available */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onEdit();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-text-secondary">
                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                </svg>
                Edit
              </button>

              {/* Mark Complete — CONFIRMED */}
              {canComplete && onComplete && (
                <button
                  type="button"
                  onClick={async (e) => {
                    e.stopPropagation();
                    setActing(true);
                    try { await onComplete(); } finally { setActing(false); setOpen(false); }
                  }}
                  disabled={acting}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-success hover:bg-surface-success/50 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                  </svg>
                  {acting ? "..." : "Mark Complete"}
                </button>
              )}

              {/* Cancel — PENDING, OVERDUE, CONFIRMED */}
              {canCancel && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingAction("cancel");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-error hover:bg-surface-error/50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                  </svg>
                  Cancel Appointment
                </button>
              )}

              {/* Delete — COMPLETED, CANCELLED */}
              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingAction("delete");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-error hover:bg-surface-error/50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
                  </svg>
                  Delete
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 space-y-2">
              <p className="text-xs text-text-secondary">
                {confirmingAction === "cancel"
                  ? "Cancel this appointment? This cannot be undone."
                  : "Permanently delete this appointment? This cannot be undone."}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirmingAction === "cancel") handleCancel();
                    else handleDelete();
                  }}
                  disabled={acting}
                  className="flex-1 rounded bg-interactive-error px-2 py-1 text-xs text-text-inverse hover:bg-interactive-error-hover disabled:opacity-50"
                >
                  {acting ? "..." : "Yes"}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmingAction(null);
                  }}
                  disabled={acting}
                  className="flex-1 rounded border border-border-secondary px-2 py-1 text-xs text-text-secondary hover:bg-surface-secondary"
                >
                  No
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// --- Main Table ---

export default function PatientTable({
  appointments,
  onRefresh,
  highlightId,
}: PatientTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("preferredDateTime");
  const [sortAsc, setSortAsc] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmingAction, setConfirmingAction] = useState<"cancel" | "delete" | null>(null);

  // Modal state
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRow | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentRow | null>(null);

  // Clear selection when appointments change
  useEffect(() => {
    setSelectedIds(new Set());
    setConfirmingAction(null);
  }, [appointments]);

  const sorted = useMemo(() => {
    const arr = [...appointments];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.patient.name.localeCompare(b.patient.name);
          break;
        case "preferredDateTime":
          cmp = a.preferredDateTime.localeCompare(b.preferredDateTime);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [appointments, sortKey, sortAsc]);

  const someSelected = selectedIds.size > 0;
  const allSelected = sorted.length > 0 && sorted.every((a) => selectedIds.has(a.id));

  const selectedAppointments = useMemo(
    () => sorted.filter((a) => selectedIds.has(a.id)),
    [sorted, selectedIds]
  );

  const cancellableSelected = useMemo(
    () => selectedAppointments.filter((a) => a.status === "PENDING" || a.status === "OVERDUE"),
    [selectedAppointments]
  );

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sorted.map((a) => a.id)));
    }
    setConfirmingAction(null);
  }

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
    setConfirmingAction(null);
  }

  async function executeBulkCancel() {
    setBulkCancelling(true);
    try {
      const res = await fetch("/api/appointments/bulk-cancel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: cancellableSelected.map((a) => a.id) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        onRefresh();
      }
    } catch {
      // silently fail
    } finally {
      setBulkCancelling(false);
      setConfirmingAction(null);
    }
  }

  async function executeBulkDelete() {
    setBulkDeleting(true);
    try {
      const res = await fetch("/api/appointments/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedAppointments.map((a) => a.id) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        onRefresh();
      }
    } catch {
      // silently fail
    } finally {
      setBulkDeleting(false);
      setConfirmingAction(null);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " \u2191" : " \u2193") : "";

  const thClass =
    "px-3 py-2 text-left text-xs font-medium text-text-hint uppercase tracking-wider cursor-pointer select-none hover:text-text-brand";
  const thStatic =
    "px-3 py-2 text-left text-xs font-medium text-text-hint uppercase tracking-wider";

  if (appointments.length === 0) {
    return (
      <div className="rounded-lg border border-border-primary bg-surface-primary p-8 text-center">
        <p className="text-sm text-text-hint">
          No appointments yet. Click &quot;New Appointment&quot; to register a patient.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="flex items-center justify-between rounded-lg border border-border-primary bg-surface-secondary px-4 py-2.5">
          {confirmingAction === null ? (
            <>
              <span className="text-sm font-medium text-text-primary">
                {selectedIds.size} selected
              </span>
              <div className="flex items-center gap-2">
                {cancellableSelected.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmingAction("cancel")}
                    disabled={bulkCancelling || bulkDeleting}
                  >
                    Cancel ({cancellableSelected.length})
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingAction("delete")}
                  disabled={bulkCancelling || bulkDeleting}
                  className="text-text-error border-border-error hover:bg-surface-error/50"
                >
                  Delete ({selectedIds.size})
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds(new Set());
                    setConfirmingAction(null);
                  }}
                  className="text-sm text-text-hint hover:text-text-secondary"
                >
                  Clear
                </button>
              </div>
            </>
          ) : confirmingAction === "cancel" ? (
            <>
              <span className="text-sm text-text-primary">
                Cancel {cancellableSelected.length} appointment{cancellableSelected.length !== 1 ? "s" : ""}? This cannot be undone.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={executeBulkCancel}
                  loading={bulkCancelling}
                  loadingText="Cancelling..."
                  className="bg-interactive-error hover:bg-interactive-error-hover"
                >
                  Yes, Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingAction(null)}
                  disabled={bulkCancelling}
                >
                  No
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="text-sm text-text-primary">
                Permanently delete {selectedIds.size} appointment{selectedIds.size !== 1 ? "s" : ""}? This cannot be undone.
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={executeBulkDelete}
                  loading={bulkDeleting}
                  loadingText="Deleting..."
                  className="bg-interactive-error hover:bg-interactive-error-hover"
                >
                  Yes, Delete
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmingAction(null)}
                  disabled={bulkDeleting}
                >
                  No
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border-primary">
        <table className="min-w-full divide-y divide-border-primary">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="w-8 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="accent-interactive-primary h-4 w-4 rounded"
                  aria-label="Select all"
                />
              </th>
              <th className={thClass} onClick={() => handleSort("name")}>
                Name{sortIndicator("name")}
              </th>
              <th className={thStatic}>Phone</th>
              <th className={thStatic}>Visit type</th>
              <th className={thStatic}>Doctor</th>
              <th className={thClass} onClick={() => handleSort("preferredDateTime")}>
                Scheduled{sortIndicator("preferredDateTime")}
              </th>
              <th className={thStatic}>Payment</th>
              <th className={thClass} onClick={() => handleSort("status")}>
                Status{sortIndicator("status")}
              </th>
              <th className={thStatic}>Print</th>
              <th className={thStatic}>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-primary bg-surface-primary">
            {sorted.map((a) => {
              const isHighlighted = highlightId === a.id;
              const statusBadge = STATUS_BADGE[a.status];

              const balance =
                a.totalAmount != null ? a.totalAmount - a.totalPaid : null;

              return (
                <tr
                  key={a.id}
                  onClick={() => setSelectedAppointment(a)}
                  className={`cursor-pointer text-sm hover:bg-surface-secondary/50 ${isHighlighted ? "animate-pulse bg-surface-warning" : ""} ${selectedIds.has(a.id) ? "bg-surface-brand/5" : ""}`}
                >
                  {/* Checkbox */}
                  <td
                    className="whitespace-nowrap px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                      className="accent-interactive-primary h-4 w-4 rounded"
                      aria-label={`Select appointment for ${a.patient.name}`}
                    />
                  </td>

                  {/* Name — clickable for patient details */}
                  <td className="whitespace-nowrap px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPatient(a.patient);
                        }}
                        className="cursor-pointer text-sm font-medium text-text-brand underline-offset-2 hover:underline"
                      >
                        {a.patient.name}
                      </button>
                      {a.priority === "URGENT" && (
                        <Badge variant={PRIORITY_BADGE.URGENT.variant} className="text-xs">
                          Urgent
                        </Badge>
                      )}
                      {a.priority === "EMERGENCY" && (
                        <Badge variant={PRIORITY_BADGE.EMERGENCY.variant} className="text-xs">
                          Emergency
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Phone */}
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">
                    {a.patient.phone}
                  </td>

                  {/* Visit type */}
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">
                    {VISIT_TYPE_LABEL[a.visitType]}
                  </td>

                  {/* Doctor */}
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">
                    {a.doctor?.name ?? <span className="text-text-tertiary">—</span>}
                  </td>

                  {/* Scheduled */}
                  <td className="whitespace-nowrap px-3 py-2 text-text-secondary">
                    {formatISTDateTime(new Date(a.preferredDateTime))}
                  </td>

                  {/* Payment */}
                  <td className="whitespace-nowrap px-3 py-2">
                    {a.isWaived ? (
                      <span className="text-text-secondary font-medium">Waived</span>
                    ) : balance == null ? (
                      <span className="text-text-tertiary">—</span>
                    ) : balance === 0 ? (
                      <span className="text-text-success font-medium">Paid</span>
                    ) : (
                      <span className="text-text-error font-medium">₹{balance.toFixed(2)} due</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-3 py-2">
                    <Badge variant={statusBadge.variant}>
                      {statusBadge.label}
                    </Badge>
                  </td>

                  {/* Print */}
                  <td className="whitespace-nowrap px-3 py-2">
                    {(a.status === "CONFIRMED" || a.status === "COMPLETED") && (
                      <a
                        href={`/admin/dashboard/prescription/blank/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 rounded border border-border-secondary px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                          <path fillRule="evenodd" d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.679 2.679 0 0118 9.086v6.664a2.679 2.679 0 01-2.679 2.679H4.679A2.679 2.679 0 012 15.75V9.086a2.679 2.679 0 012.874-2.631c.374-.056.749-.107 1.126-.153V2.75zm1.5 0v3.324a49.289 49.289 0 016.996 0V2.75a.25.25 0 00-.25-.25h-6.5a.25.25 0 00-.25.25zm-3.3 7.22a1.179 1.179 0 011.628-1.628l.002.001A47.806 47.806 0 0110 8.498a47.8 47.8 0 014.17.846l.003-.002a1.179 1.179 0 011.628 1.628 47.806 47.806 0 01-5.8.846 47.8 47.8 0 01-5.8-.846zM5 13.5a.75.75 0 01.75-.75h8.5a.75.75 0 010 1.5h-8.5A.75.75 0 015 13.5zm.75 2.25a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z" clipRule="evenodd" />
                        </svg>
                        Print
                      </a>
                    )}
                  </td>

                  {/* Actions: Kebab */}
                  <td
                    className="whitespace-nowrap px-3 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <KebabMenu
                      appointment={a}
                      onEdit={() => setEditingAppointment(a)}
                      onRefresh={onRefresh}
                      onComplete={a.status === "CONFIRMED" ? async () => {
                        const res = await fetch(`/api/appointments/${a.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "COMPLETED" }),
                        });
                        if (res.ok) onRefresh();
                      } : undefined}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>


      {/* Patient Details Modal */}
      {selectedPatient && (
        <PatientDetailsModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}

      {/* Appointment Details Modal */}
      {selectedAppointment && (
        <AppointmentDetailsModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
          onEdit={(appt) => { setSelectedAppointment(null); setEditingAppointment(appt); }}
          onRefresh={onRefresh}
        />
      )}

      {/* Edit Appointment Modal */}
      {editingAppointment && (
        <EditAppointmentModal
          appointment={editingAppointment}
          onClose={() => setEditingAppointment(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
}
