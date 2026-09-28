"use client";

import { useState, useCallback } from "react";
import { formatISTDateTime } from "@/lib/utils/date";
import type { ApiJson } from "@/types/api";

export interface PaymentEntry {
  id: string;
  amount: number;
  method: string;
  notes: string | null;
  paidAt: string;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  WAIVED: "Waived",
  OTHER: "Other",
};

const METHODS = ["CASH", "UPI", "CARD", "WAIVED", "OTHER"] as const;

interface PaymentRowProps {
  payment: PaymentEntry;
  onRefresh: () => void;
}

export function PaymentRow({ payment, onRefresh }: PaymentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [draftAmount, setDraftAmount] = useState(String(payment.amount));
  const [draftMethod, setDraftMethod] = useState(payment.method);
  const [draftNotes, setDraftNotes] = useState(payment.notes ?? "");

  function openEdit() {
    setDraftAmount(String(payment.amount));
    setDraftMethod(payment.method);
    setDraftNotes(payment.notes ?? "");
    setError("");
    setConfirmingDelete(false);
    setExpanded(true);
  }

  function close() {
    setExpanded(false);
    setConfirmingDelete(false);
    setError("");
  }

  const handleSave = useCallback(async () => {
    const parsed = parseFloat(draftAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setError("Enter a valid amount greater than 0.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parsed,
          method: draftMethod,
          notes: draftNotes.trim() || null,
        }),
      });
      const data = (await res.json()) as ApiJson;
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setExpanded(false);
      onRefresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [payment.id, draftAmount, draftMethod, draftNotes, onRefresh]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/payments/${payment.id}`, { method: "DELETE" });
      if (res.ok) onRefresh();
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
    }
  }, [payment.id, onRefresh]);

  return (
    <div className="space-y-2">
      {/* Payment summary row — always visible */}
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 rounded-full border border-border-primary bg-surface-tertiary px-2 py-0.5 text-text-hint">
            {METHOD_LABELS[payment.method] ?? payment.method}
          </span>
          <span className="truncate text-text-hint">
            {formatISTDateTime(new Date(payment.paidAt))}
          </span>
          {payment.notes && (
            <span className="truncate text-text-tertiary italic">· {payment.notes}</span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <span className="font-medium text-text-primary">₹{payment.amount.toFixed(2)}</span>
          <button
            type="button"
            onClick={expanded ? close : openEdit}
            className={`rounded px-2 py-0.5 text-xs font-medium border transition-colors ${
              expanded
                ? "border-border-secondary bg-surface-secondary text-text-secondary hover:bg-surface-tertiary"
                : "border-border-secondary bg-surface-primary text-text-secondary hover:bg-surface-secondary"
            }`}
          >
            {expanded ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {/* Expanded edit panel */}
      {expanded && (
        <div className="rounded-md border border-border-primary bg-surface-secondary p-3 space-y-3">
          {error && (
            <p className="rounded bg-red-100 px-2 py-1.5 text-xs font-medium text-red-700">
              {error}
            </p>
          )}

          {/* Amount */}
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-hint mb-1">Amount (₹)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={draftAmount}
                onChange={(e) => setDraftAmount(e.target.value)}
                autoFocus
                className="w-full rounded-md border border-border-primary bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-focus-ring"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-text-hint mb-1">Method</label>
              <select
                value={draftMethod}
                onChange={(e) => setDraftMethod(e.target.value)}
                className="w-full rounded-md border border-border-primary bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-focus-ring"
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-text-hint mb-1">
              Notes <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Partial payment, UPI ref #123"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              maxLength={500}
              className="w-full rounded-md border border-border-primary bg-surface-primary px-2.5 py-1.5 text-sm text-text-primary focus:border-border-focus focus:outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>

          {/* Save / Delete actions */}
          {!confirmingDelete ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-interactive-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-interactive-primary-hover disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                Delete entry
              </button>
            </div>
          ) : (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 space-y-2">
              <p className="text-xs font-medium text-red-800">
                Delete this payment entry? This cannot be undone.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  No, keep it
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
