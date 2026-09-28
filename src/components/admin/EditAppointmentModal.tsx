"use client";

import { useEffect, useState, useCallback } from "react";
import { DateTime } from "luxon";
import type { AppointmentRow } from "@/types/patient";
import { CHANNEL_LABEL, VISIT_TYPE_LABEL } from "@/lib/constants/appointment";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PaymentRow } from "@/components/admin/PaymentRow";
import type { PaymentEntry } from "@/components/admin/PaymentRow";
import type { ApiJson } from "@/types/api";

interface Doctor {
  id: string;
  name: string;
  qualifications: string | null;
}

interface EditAppointmentModalProps {
  appointment: AppointmentRow;
  onClose: () => void;
  onRefresh: () => void;
}

export function EditAppointmentModal({
  appointment,
  onClose,
  onRefresh,
}: EditAppointmentModalProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Format IST for datetime-local input
  const istFormatted = DateTime.fromISO(appointment.preferredDateTime)
    .setZone("Asia/Kolkata")
    .toFormat("yyyy-MM-dd'T'HH:mm");

  const [bookingChannel, setBookingChannel] = useState(appointment.bookingChannel);
  const [visitType, setVisitType] = useState(appointment.visitType);
  const [doctorId, setDoctorId] = useState(appointment.doctorId ?? "");
  const [preferredDateTime, setPreferredDateTime] = useState(istFormatted);
  const [reasonForVisit, setReasonForVisit] = useState(appointment.reasonForVisit ?? "");
  const [totalAmount, setTotalAmount] = useState(
    appointment.totalAmount != null ? String(appointment.totalAmount) : ""
  );

  // Existing payments
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);

  // Instalment form
  const [showInstalmentForm, setShowInstalmentForm] = useState(false);
  const [instalmentAmount, setInstalmentAmount] = useState("");
  const [instalmentMethod, setInstalmentMethod] = useState("CASH");
  const [instalmentComment, setInstalmentComment] = useState("");
  const [instalmentWaived, setInstalmentWaived] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  // Staged (not-yet-saved) instalment — only POSTed when "Save changes" is clicked
  const [stagedInstalment, setStagedInstalment] = useState<{
    amount: number;
    method: string;
    notes: string | null;
  } | null>(null);

  // Fetch active doctors
  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json() as Promise<ApiJson & { doctors: Doctor[] }>)
      .then((data) => { if (data.success) setDoctors(data.doctors); })
      .catch(() => {});
  }, []);

  // Fetch payment history
  useEffect(() => {
    if (appointment.status === "CANCELLED") return;
    setPaymentsLoading(true);
    fetch(`/api/payments?appointmentId=${appointment.id}`)
      .then((r) => r.json() as Promise<ApiJson & { payments: PaymentEntry[] }>)
      .then((data) => { if (data.success) setPayments(data.payments); })
      .catch(() => {})
      .finally(() => setPaymentsLoading(false));
  }, [appointment.id, appointment.status, paymentRefreshKey]);

  // Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");

    const body: Record<string, unknown> = {
      bookingChannel,
      visitType,
      doctorId: doctorId || null,
      preferredDateTime,
      reasonForVisit: reasonForVisit.trim() || undefined,
    };

    if (totalAmount.trim() !== "") {
      const val = parseFloat(totalAmount);
      if (isNaN(val) || val < 0) {
        setError("Total amount must be a positive number.");
        setSaving(false);
        return;
      }
      body.totalAmount = val;
    } else {
      body.totalAmount = null;
    }

    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ApiJson;
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to save. Please try again.");
        return;
      }

      // POST staged instalment (if any) only after appointment is saved
      if (stagedInstalment) {
        const payRes = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appointmentId: appointment.id,
            amount: stagedInstalment.amount,
            method: stagedInstalment.method,
            notes: stagedInstalment.notes,
          }),
        });
        const payData = (await payRes.json()) as ApiJson;
        if (!payRes.ok || !payData.success) {
          setError(payData.error ?? "Appointment saved, but failed to record payment.");
          return;
        }
      }

      onClose();
      onRefresh();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [appointment.id, bookingChannel, visitType, doctorId, preferredDateTime, reasonForVisit, totalAmount, stagedInstalment, onClose, onRefresh]);

  const handleStageInstalment = useCallback(() => {
    setPaymentError("");
    const parsedTotal = totalAmount !== "" ? parseFloat(totalAmount) : 0;
    const parsedAmount = instalmentAmount !== "" ? parseFloat(instalmentAmount) : 0;

    if (instalmentWaived && parsedTotal <= 0) {
      setPaymentError("Set a total amount before waiving.");
      return;
    }
    if (!instalmentWaived && parsedAmount <= 0) {
      setPaymentError("Enter a valid payment amount.");
      return;
    }

    setStagedInstalment({
      amount: instalmentWaived ? parsedTotal : parsedAmount,
      method: instalmentWaived ? "WAIVED" : instalmentMethod,
      notes: instalmentComment.trim() || null,
    });

    // Reset form — instalment is now staged, shown as pending row
    setInstalmentAmount("");
    setInstalmentMethod("CASH");
    setInstalmentComment("");
    setInstalmentWaived(false);
    setShowInstalmentForm(false);
  }, [instalmentWaived, instalmentAmount, instalmentMethod, instalmentComment, totalAmount]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0) + (stagedInstalment?.amount ?? 0);
  const parsedTotal = totalAmount !== "" ? parseFloat(totalAmount) : null;
  const balance = parsedTotal != null ? parsedTotal - totalPaid : null;
  const isPartial = balance != null && balance > 0;
  const isWaivedLocally = payments.some((p) => p.method === "WAIVED") || stagedInstalment?.method === "WAIVED";

  const labelClass = "block text-xs font-medium text-text-hint mb-1";
  const inputClass =
    "w-full rounded-md border border-border-primary bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-focus-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border-primary bg-surface-primary shadow-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-6 py-4 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Edit Appointment</h3>
            <p className="text-xs text-text-hint mt-0.5">{appointment.patient.name}</p>
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

        {/* Form — scrollable */}
        <div className="overflow-y-auto flex-1 space-y-4 px-6 py-4">
          {error && <Alert variant="error">{error}</Alert>}

          {/* Booking method */}
          <div>
            <label className={labelClass}>Booking method</label>
            <select
              value={bookingChannel}
              onChange={(e) => setBookingChannel(e.target.value as typeof bookingChannel)}
              className={inputClass}
            >
              {(Object.keys(CHANNEL_LABEL) as Array<keyof typeof CHANNEL_LABEL>).map((ch) => (
                <option key={ch} value={ch}>{CHANNEL_LABEL[ch]}</option>
              ))}
            </select>
          </div>

          {/* Visit type */}
          <div>
            <label className={labelClass}>Visit type</label>
            <select
              value={visitType}
              onChange={(e) => setVisitType(e.target.value as typeof visitType)}
              className={inputClass}
            >
              {(Object.keys(VISIT_TYPE_LABEL) as Array<keyof typeof VISIT_TYPE_LABEL>).map((vt) => (
                <option key={vt} value={vt}>{VISIT_TYPE_LABEL[vt]}</option>
              ))}
            </select>
          </div>

          {/* Treating doctor */}
          <div>
            <label className={labelClass}>Treating doctor</label>
            <select
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className={inputClass}
            >
              <option value="">— No doctor assigned —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.qualifications ? ` (${d.qualifications})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled for */}
          <div>
            <label className={labelClass}>Scheduled for (IST)</label>
            <input
              type="datetime-local"
              value={preferredDateTime}
              onChange={(e) => setPreferredDateTime(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Chief complaint */}
          <div>
            <label className={labelClass}>Chief complaint</label>
            <textarea
              value={reasonForVisit}
              onChange={(e) => setReasonForVisit(e.target.value)}
              rows={3}
              maxLength={1000}
              className={`${inputClass} resize-none`}
              placeholder="Describe the chief complaint..."
            />
          </div>

          {/* Payment section */}
          {appointment.status !== "CANCELLED" && (
            <div className="space-y-3 border-t border-border-primary pt-4">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Payment</p>

              {/* Total amount */}
              <div>
                <label className={labelClass}>Total amount (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              {/* Existing payments */}
              {paymentsLoading ? (
                <p className="text-xs text-text-hint">Loading payments…</p>
              ) : payments.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-text-hint">Payments recorded</p>
                  <div className="space-y-1.5">
                    {payments.map((p) => (
                      <PaymentRow
                        key={p.id}
                        payment={p}
                        onRefresh={() => setPaymentRefreshKey((k) => k + 1)}
                      />
                    ))}

                    {/* Staged instalment — not yet saved */}
                    {stagedInstalment && (
                      <div className="flex items-center justify-between rounded-md border border-dashed border-border-secondary bg-surface-secondary px-3 py-2 text-xs text-text-secondary">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-border-primary bg-surface-tertiary px-2 py-0.5 text-text-hint">
                            {stagedInstalment.method === "WAIVED" ? "Waived" : stagedInstalment.method === "CASH" ? "Cash" : stagedInstalment.method === "UPI" ? "UPI" : stagedInstalment.method === "CARD" ? "Card" : "Other"}
                          </span>
                          <span className="italic text-text-hint">Pending save</span>
                          {stagedInstalment.notes && (
                            <span className="text-text-tertiary italic">· {stagedInstalment.notes}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-text-primary">₹{stagedInstalment.amount.toFixed(2)}</span>
                          <button
                            type="button"
                            onClick={() => setStagedInstalment(null)}
                            className="rounded px-2 py-0.5 text-xs font-medium border border-border-secondary text-text-secondary hover:bg-surface-tertiary"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Balance summary */}
                  {parsedTotal != null && (
                    <div className={`flex justify-between rounded-md border border-border-primary bg-surface-secondary px-3 py-2 text-xs font-semibold ${
                      isWaivedLocally
                        ? "text-text-secondary"
                        : balance === 0
                        ? "text-text-success"
                        : "text-text-error"
                    }`}>
                      <span>
                        {isWaivedLocally ? "Waived" : balance === 0 ? "Paid in full" : "Outstanding"}
                      </span>
                      <span>
                        {isWaivedLocally ? "—" : balance === 0 ? "✓" : `₹${balance!.toFixed(2)}`}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-text-hint">No payments recorded yet.</p>
              )}

              {/* Add instalment button — shown when partial payment and nothing staged yet */}
              {isPartial && !showInstalmentForm && !isWaivedLocally && !stagedInstalment && (
                <button
                  type="button"
                  onClick={() => setShowInstalmentForm(true)}
                  className="text-xs font-medium text-interactive-primary hover:text-interactive-primary-hover"
                >
                  + Add next instalment
                </button>
              )}

              {/* Instalment form */}
              {showInstalmentForm && (
                <div className="rounded-md border border-border-primary bg-surface-secondary p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-text-primary">Record instalment</p>
                    <button
                      type="button"
                      onClick={() => { setShowInstalmentForm(false); setPaymentError(""); }}
                      className="text-text-tertiary hover:text-text-secondary"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>

                  {paymentError && <Alert variant="error">{paymentError}</Alert>}

                  {/* Waive toggle */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={instalmentWaived}
                        onChange={(e) => setInstalmentWaived(e.target.checked)}
                      />
                      <div className="h-5 w-9 rounded-full border border-border-secondary bg-surface-primary peer-checked:bg-interactive-primary peer-checked:border-interactive-primary transition-colors" />
                      <div className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                    </div>
                    <span className="text-xs text-text-primary">Waive remaining balance</span>
                  </label>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-text-hint mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder={instalmentWaived ? `${balance?.toFixed(2)} (waived)` : "0.00"}
                      value={instalmentAmount}
                      onChange={(e) => setInstalmentAmount(e.target.value)}
                      disabled={instalmentWaived}
                      className={`w-full rounded-md border border-border-primary bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-focus-ring disabled:opacity-40`}
                    />
                  </div>

                  {/* Payment mode */}
                  {!instalmentWaived && (
                    <div>
                      <label className="block text-xs font-medium text-text-hint mb-1">Mode</label>
                      <div className="flex flex-wrap gap-1.5">
                        {(["CASH", "UPI", "CARD", "OTHER"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setInstalmentMethod(m)}
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                              instalmentMethod === m
                                ? "border-border-focus bg-surface-highlight text-text-primary"
                                : "border-border-primary bg-surface-primary text-text-secondary hover:bg-surface-tertiary"
                            }`}
                          >
                            {m === "CASH" ? "Cash" : m === "UPI" ? "UPI" : m === "CARD" ? "Card" : "Other"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comment */}
                  <div>
                    <label className="block text-xs font-medium text-text-hint mb-1">Comment <span className="font-normal">(optional)</span></label>
                    <input
                      type="text"
                      placeholder={instalmentWaived ? "e.g. Waived for financial hardship" : "e.g. Second instalment"}
                      value={instalmentComment}
                      onChange={(e) => setInstalmentComment(e.target.value)}
                      className="w-full rounded-md border border-border-primary bg-surface-primary px-3 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-focus-ring"
                      maxLength={500}
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleStageInstalment}
                  >
                    Stage payment
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 border-t border-border-primary px-6 py-4 shrink-0">
          <Button
            variant="primary"
            loading={saving}
            loadingText="Saving..."
            onClick={handleSave}
          >
            Save changes
          </Button>
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
