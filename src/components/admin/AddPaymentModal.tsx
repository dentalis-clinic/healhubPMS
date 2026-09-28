"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatISTDateTime } from "@/lib/utils/date";
import type { ApiJson } from "@/types/api";

interface OpenBill {
  appointmentId: string;
  appointmentRef: string;
  preferredDateTime: string;
  status: string;
  amountDue: number;
  totalPaid: number;
  balance: number;
  reasonForVisit: string | null;
}

interface AddPaymentModalProps {
  patientId: string; // UUID — used to fetch open bills
  patientName: string;
  /** Pre-select this appointment's bill in the dropdown */
  defaultAppointmentId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  WAIVED: "Waived",
  OTHER: "Other",
};

export function AddPaymentModal({
  patientId,
  patientName,
  defaultAppointmentId,
  onClose,
  onSuccess,
}: AddPaymentModalProps) {
  const [bills, setBills] = useState<OpenBill[]>([]);
  const [billsLoading, setBillsLoading] = useState(true);
  const [billsError, setBillsError] = useState("");

  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    defaultAppointmentId ?? ""
  );
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("CASH");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch open bills for this patient
  useEffect(() => {
    setBillsLoading(true);
    setBillsError("");
    fetch(`/api/payments/open-bills?patientId=${patientId}`)
      .then((r) => r.json() as Promise<ApiJson & { openBills: OpenBill[] }>)
      .then((data) => {
        if (data.success) {
          setBills(data.openBills);
          // Pre-select the default if it's in the list
          if (defaultAppointmentId && data.openBills.some((b: OpenBill) => b.appointmentId === defaultAppointmentId)) {
            setSelectedAppointmentId(defaultAppointmentId);
          } else if (data.openBills.length === 1) {
            setSelectedAppointmentId(data.openBills[0].appointmentId);
          }
        } else {
          setBillsError("Could not load open bills.");
        }
      })
      .catch(() => setBillsError("Could not load open bills."))
      .finally(() => setBillsLoading(false));
  }, [patientId, defaultAppointmentId]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const selectedBill = bills.find((b) => b.appointmentId === selectedAppointmentId);

  const handleSubmit = useCallback(async () => {
    setError("");

    if (!selectedAppointmentId) {
      setError("Please select a bill to apply this payment to.");
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!amount.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: selectedAppointmentId,
          amount: parsedAmount,
          method,
          notes: notes.trim() || null,
        }),
      });

      const data = (await res.json()) as ApiJson;
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to record payment.");
        return;
      }

      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [selectedAppointmentId, amount, method, notes, onSuccess]);

  const labelClass = "block text-xs font-medium text-text-secondary mb-1";
  const inputClass =
    "w-full rounded-md border border-border-primary bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-focus-ring disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border-primary bg-surface-primary shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Record Payment</h3>
            <p className="text-xs text-text-hint mt-0.5">{patientName}</p>
          </div>
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

        {/* Body */}
        <div className="space-y-4 px-6 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          {/* Bill selector */}
          <div>
            <label className={labelClass}>Apply payment to</label>
            {billsLoading ? (
              <div className="text-sm text-text-hint py-1">Loading open bills…</div>
            ) : billsError ? (
              <Alert variant="error">{billsError}</Alert>
            ) : bills.length === 0 ? (
              <div className="rounded-md border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-text-hint">
                No open bills for this patient.
              </div>
            ) : (
              <select
                value={selectedAppointmentId}
                onChange={(e) => setSelectedAppointmentId(e.target.value)}
                className={inputClass}
                disabled={submitting}
              >
                <option value="">— Select a bill —</option>
                {bills.map((bill) => (
                  <option key={bill.appointmentId} value={bill.appointmentId}>
                    {bill.appointmentRef} · {formatISTDateTime(new Date(bill.preferredDateTime))} · Balance ₹{bill.balance.toFixed(2)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Selected bill summary */}
          {selectedBill && (
            <div className="rounded-md border border-border-primary bg-surface-secondary px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between text-text-secondary">
                <span>Amount due</span>
                <span className="font-medium">₹{selectedBill.amountDue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Already paid</span>
                <span>₹{selectedBill.totalPaid.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-border-primary pt-1 text-text-primary font-medium">
                <span>Outstanding</span>
                <span>₹{selectedBill.balance.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className={labelClass}>Amount (₹)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
              disabled={submitting}
              autoFocus
            />
          </div>

          {/* Payment method */}
          <div>
            <label className={labelClass}>Payment method</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(METHOD_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMethod(key)}
                  disabled={submitting}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    method === key
                      ? "border-border-focus bg-surface-highlight text-text-primary"
                      : "border-border-primary bg-surface-primary text-text-secondary hover:bg-surface-secondary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Notes <span className="text-text-tertiary font-normal">(optional)</span></label>
            <input
              type="text"
              placeholder={method === "WAIVED" ? "e.g. Waived for financial hardship" : "e.g. Partial payment"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              disabled={submitting}
              maxLength={500}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border-primary px-6 py-4">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            loadingText="Recording…"
            onClick={handleSubmit}
            disabled={bills.length === 0 || billsLoading}
          >
            Record Payment
          </Button>
        </div>
      </div>
    </div>
  );
}
