"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  tone?: "danger" | "default";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Native <dialog> as the alert-dialog primitive: showModal() gives focus
 * trapping, Escape-to-close and an inert background without a dependency.
 * Children may include inputs; the confirm button submits the inner form.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  tone = "default",
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  // Sync React state to the imperative dialog API.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!busy) onConfirm();
  }

  const confirmTone =
    tone === "danger"
      ? "bg-interactive-error text-text-inverse hover:bg-interactive-error-hover"
      : "bg-interactive-primary text-text-inverse hover:bg-interactive-primary-hover";

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      aria-labelledby="confirm-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-border-primary bg-surface-primary p-0 text-text-primary shadow-lg backdrop:bg-surface-overlay/30"
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-balance">
          {title}
        </h2>
        <div className="space-y-3 text-sm text-text-secondary text-pretty">{children}</div>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border-secondary bg-surface-primary px-3 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${confirmTone}`}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
