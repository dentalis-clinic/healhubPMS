"use client";

import { useEffect, useState, useCallback } from "react";
import type { AppointmentRow } from "@/types/patient";
import { CHANNEL_LABEL, VISIT_TYPE_LABEL } from "@/lib/constants/appointment";
import { formatISTDateTime } from "@/lib/utils/date";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PaymentRow } from "@/components/admin/PaymentRow";
import type { PaymentEntry } from "@/components/admin/PaymentRow";
import type { ApiJson } from "@/types/api";

interface AppointmentDetailsModalProps {
  appointment: AppointmentRow;
  onClose: () => void;
  onEdit: (appointment: AppointmentRow) => void;
  onRefresh: () => void;
}

export function AppointmentDetailsModal({
  appointment,
  onClose,
  onEdit,
  onRefresh,
}: AppointmentDetailsModalProps) {
  const [cancelling, setCancelling] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Billing state
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const showBilling = appointment.status !== "CANCELLED";

  const canCancel =
    appointment.status === "PENDING" ||
    appointment.status === "OVERDUE" ||
    appointment.status === "CONFIRMED";
  const canDelete =
    appointment.status === "COMPLETED" || appointment.status === "CANCELLED";

  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  // Fetch payment history
  useEffect(() => {
    if (!showBilling) return;
    setPaymentsLoading(true);
    fetch(`/api/payments?appointmentId=${appointment.id}`)
      .then((r) => r.json() as Promise<ApiJson & { payments: PaymentEntry[] }>)
      .then((data) => { if (data.success) setPayments(data.payments); })
      .catch(() => {})
      .finally(() => setPaymentsLoading(false));
  }, [appointment.id, showBilling, paymentRefreshKey]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      if (res.ok) { onClose(); onRefresh(); }
      else setCancelError("Failed to cancel. Please try again.");
    } catch {
      setCancelError("Failed to cancel. Please try again.");
    } finally {
      setCancelling(false);
    }
  }, [appointment.id, onClose, onRefresh]);

  const handleDelete = useCallback(async () => {
    try {
      const res = await fetch("/api/appointments/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [appointment.id] }),
      });
      if (res.ok) { onClose(); onRefresh(); }
    } catch {
      // silently fail
    }
  }, [appointment.id, onClose, onRefresh]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const amountDue = appointment.totalAmount ?? null;
  const balance = amountDue != null ? amountDue - totalPaid : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border-primary bg-surface-primary shadow-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4 shrink-0">
          <h3 className="text-base font-semibold text-text-primary">Appointment Details</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-text-tertiary hover:bg-surface-tertiary hover:text-text-secondary"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          {/* Appointment info */}
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-hint">Patient</dt>
              <dd className="font-medium text-text-primary">{appointment.patient.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-hint">Phone</dt>
              <dd className="text-text-primary">{appointment.patient.phone}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-hint">Created on</dt>
              <dd className="text-text-primary">{formatISTDateTime(new Date(appointment.createdAt))}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-hint">Booking method</dt>
              <dd className="text-text-primary">{CHANNEL_LABEL[appointment.bookingChannel]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-hint">Visit type</dt>
              <dd className="text-text-primary">{VISIT_TYPE_LABEL[appointment.visitType]}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-hint">Treating doctor</dt>
              <dd className="text-text-primary">{appointment.doctor?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-hint">Scheduled for</dt>
              <dd className="text-text-primary">{formatISTDateTime(new Date(appointment.preferredDateTime))}</dd>
            </div>
            <div className="flex gap-4 justify-between">
              <dt className="shrink-0 text-text-hint">Chief complaint</dt>
              <dd className="text-right text-text-primary">{appointment.reasonForVisit ?? "—"}</dd>
            </div>
          </dl>

          {/* Billing — read-only */}
          {showBilling && (
            <div className="border-t border-border-primary pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-text-primary">Billing</h4>

              {amountDue == null ? (
                <p className="text-xs text-text-hint">No bill amount set.</p>
              ) : (
                <>
                  <div className="rounded-md border border-border-primary bg-surface-secondary px-3 py-2 text-xs space-y-1.5">
                    <div className="flex justify-between text-text-secondary">
                      <span>Bill amount</span>
                      <span className="font-medium">₹{amountDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-text-secondary">
                      <span>Total paid</span>
                      <span>₹{totalPaid.toFixed(2)}</span>
                    </div>
                    <div className={`flex justify-between border-t border-border-primary pt-1.5 font-semibold text-sm ${
                      appointment.isWaived
                        ? "text-text-secondary"
                        : balance === 0
                        ? "text-text-success"
                        : (balance ?? 0) > 0
                        ? "text-text-error"
                        : "text-text-primary"
                    }`}>
                      <span>
                        {appointment.isWaived ? "Waived" : balance === 0 ? "Paid in full" : "Outstanding"}
                      </span>
                      <span>
                        {appointment.isWaived ? "—" : balance === 0 ? "✓" : `₹${balance!.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  {/* Payment history */}
                  {paymentsLoading ? (
                    <p className="text-xs text-text-hint">Loading payments…</p>
                  ) : payments.length > 0 ? (
                    <div className="space-y-1.5">
                      {payments.map((p) => (
                        <PaymentRow
                          key={p.id}
                          payment={p}
                          onRefresh={() => setPaymentRefreshKey((k) => k + 1)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-hint">No payments recorded yet.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border-primary px-6 py-4 shrink-0 space-y-2">
          {cancelError && <Alert variant="error">{cancelError}</Alert>}

          {!confirmingCancel ? (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Edit details — always available */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => { onClose(); onEdit(appointment); }}
              >
                Edit details
              </Button>

              {/* Cancel */}
              {canCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmingCancel(true)}
                  className="text-text-error hover:bg-surface-error/50"
                >
                  Cancel appointment
                </Button>
              )}

              {/* Delete */}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="text-text-error hover:bg-surface-error/50"
                >
                  Delete
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary">Cancel this appointment? This cannot be undone.</p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  loading={cancelling}
                  loadingText="Cancelling..."
                  onClick={handleCancel}
                  className="bg-interactive-error hover:bg-interactive-error-hover"
                >
                  Yes, Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={cancelling}
                  onClick={() => { setConfirmingCancel(false); setCancelError(""); }}
                >
                  No, Go Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
