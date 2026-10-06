"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import type { ApiJson } from "@/types/api";
import { ConfirmDialog } from "./ConfirmDialog";
import { formatDate } from "./format";
import type { PlatformClinicAdmin } from "./types";

interface ClinicAdminsPanelProps {
  clinicId: string;
  clinicName: string;
  onAdminCountChange: (clinicId: string, count: number) => void;
}

const emptyNewAdmin = { name: "", email: "", password: "" };

export function ClinicAdminsPanel({ clinicId, clinicName, onAdminCountChange }: ClinicAdminsPanelProps) {
  const [admins, setAdmins] = useState<PlatformClinicAdmin[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [newAdmin, setNewAdmin] = useState(emptyNewAdmin);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [passwordTarget, setPasswordTarget] = useState<PlatformClinicAdmin | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [removeTarget, setRemoveTarget] = useState<PlatformClinicAdmin | null>(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/platform/clinics/${clinicId}/admins`);
      const json = (await res.json()) as ApiJson & { admins?: PlatformClinicAdmin[] };
      if (!res.ok || !json.admins) throw new Error(json.error ?? "Couldn't load admins.");
      setAdmins(json.admins);
      onAdminCountChange(clinicId, json.admins.length);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load admins.");
    }
  }, [clinicId, onAdminCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  function closeDialogs() {
    setPasswordTarget(null);
    setRemoveTarget(null);
    setNewPassword("");
    setDialogError(null);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setAddBusy(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/platform/clinics/${clinicId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdmin),
      });
      const json = (await res.json()) as ApiJson;
      if (!res.ok) throw new Error(json.error ?? "Couldn't add the admin.");
      setNotice(`Added ${newAdmin.email}. Share the password with them directly.`);
      setNewAdmin(emptyNewAdmin);
      setAdding(false);
      await load();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Couldn't add the admin.");
    } finally {
      setAddBusy(false);
    }
  }

  async function handleSetPassword() {
    if (!passwordTarget) return;
    if (newPassword.length < 8) {
      setDialogError("Password must be at least 8 characters.");
      return;
    }
    setDialogBusy(true);
    setDialogError(null);
    try {
      const res = await fetch(`/api/platform/admins/${passwordTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const json = (await res.json()) as ApiJson;
      if (!res.ok) throw new Error(json.error ?? "Couldn't set the password.");
      setNotice(`New password set for ${passwordTarget.email}. Share it with them directly.`);
      closeDialogs();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "Couldn't set the password.");
    } finally {
      setDialogBusy(false);
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setDialogBusy(true);
    setDialogError(null);
    try {
      const res = await fetch(`/api/platform/admins/${removeTarget.id}`, { method: "DELETE" });
      const json = (await res.json()) as ApiJson;
      if (!res.ok) throw new Error(json.error ?? "Couldn't remove the admin.");
      setNotice(`Removed ${removeTarget.email}.`);
      closeDialogs();
      await load();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "Couldn't remove the admin.");
    } finally {
      setDialogBusy(false);
    }
  }

  const isLastAdmin = (admins?.length ?? 0) <= 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium uppercase text-text-tertiary">Admin accounts</h3>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            Add admin
          </Button>
        )}
      </div>

      {notice && (
        <Alert variant="success">
          {notice}
        </Alert>
      )}
      {loadError && <Alert variant="error">{loadError}</Alert>}

      {admins === null && !loadError && (
        <div className="space-y-2" aria-busy="true" aria-label="Loading admins">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 rounded-md bg-surface-tertiary" />
          ))}
        </div>
      )}

      {admins && admins.length === 0 && (
        <p className="text-sm text-text-secondary text-pretty">
          This clinic has no admins, so nobody can sign in to it. Add one to restore access.
        </p>
      )}

      {admins && admins.length > 0 && (
        <ul className="divide-y divide-border-primary rounded-md border border-border-primary bg-surface-primary">
          {admins.map((admin) => (
            <li key={admin.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">{admin.name}</p>
                <p className="truncate text-xs text-text-tertiary">
                  {admin.email} · added {formatDate(admin.createdAt)}
                </p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setPasswordTarget(admin)}>
                  Set password
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setRemoveTarget(admin)}
                  disabled={isLastAdmin}
                  title={isLastAdmin ? "A clinic must keep at least one admin" : undefined}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form
          onSubmit={handleAdd}
          className="space-y-3 rounded-md border border-border-primary bg-surface-primary p-3"
        >
          <p className="text-sm text-text-secondary">
            New admin for <span className="font-medium text-text-primary">{clinicName}</span>. They can sign in
            straight away with this password.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField label="Name" htmlFor={`new-admin-name-${clinicId}`}>
              <Input
                id={`new-admin-name-${clinicId}`}
                value={newAdmin.name}
                onChange={(e) => setNewAdmin((a) => ({ ...a, name: e.target.value }))}
                required
                autoComplete="off"
              />
            </FormField>
            <FormField label="Email" htmlFor={`new-admin-email-${clinicId}`}>
              <Input
                id={`new-admin-email-${clinicId}`}
                type="email"
                value={newAdmin.email}
                onChange={(e) => setNewAdmin((a) => ({ ...a, email: e.target.value }))}
                required
                autoComplete="off"
              />
            </FormField>
            <FormField label="Temporary password" htmlFor={`new-admin-password-${clinicId}`} hint="At least 8 characters">
              <Input
                id={`new-admin-password-${clinicId}`}
                type="text"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin((a) => ({ ...a, password: e.target.value }))}
                required
                minLength={8}
                autoComplete="new-password"
                spellCheck={false}
              />
            </FormField>
          </div>
          {addError && <Alert variant="error">{addError}</Alert>}
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => {
                setAdding(false);
                setAddError(null);
                setNewAdmin(emptyNewAdmin);
              }}
              disabled={addBusy}
            >
              Cancel
            </Button>
            <Button size="sm" type="submit" loading={addBusy} loadingText="Adding…">
              Add admin
            </Button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={passwordTarget !== null}
        title={`Set a new password for ${passwordTarget?.name ?? ""}`}
        confirmLabel="Set password"
        busyLabel="Saving…"
        busy={dialogBusy}
        error={dialogError}
        onConfirm={handleSetPassword}
        onClose={closeDialogs}
      >
        <p>
          Their current password stops working immediately. Share the new one with them directly; there is no
          email yet.
        </p>
        <FormField label="New password" htmlFor="platform-new-password" hint="At least 8 characters">
          <Input
            id="platform-new-password"
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            autoFocus
          />
        </FormField>
      </ConfirmDialog>

      <ConfirmDialog
        open={removeTarget !== null}
        tone="danger"
        title={`Remove ${removeTarget?.name ?? ""}?`}
        confirmLabel="Remove admin"
        busyLabel="Removing…"
        busy={dialogBusy}
        error={dialogError}
        onConfirm={handleRemove}
        onClose={closeDialogs}
      >
        <p>
          <span className="font-medium text-text-primary">{removeTarget?.email}</span> loses access to{" "}
          {clinicName} and their login is deleted. This can&apos;t be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
