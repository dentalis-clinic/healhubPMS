"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { DateTime } from "luxon";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import type { ApiJson } from "@/types/api";

export interface PatientRow {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  email: string | null;
  age: number | null;
  sex: "MALE" | "FEMALE" | "OTHER" | null;
  address: string | null;
  createdAt: string;
  totalVisits: number;
  lastVisit: string | null;
  outstanding: number; // total unpaid balance across all appointments
}

interface PatientsViewProps {
  initialPatients: PatientRow[];
  initialTotal: number;
}

const PAGE_SIZE = 30;

const SEX_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return DateTime.fromISO(iso).setZone("Asia/Kolkata").toFormat("dd MMM yyyy");
}

// ----- Edit Modal -----

interface EditModalProps {
  patient: PatientRow;
  onClose: () => void;
  onSaved: (updated: PatientRow) => void;
}

function EditModal({ patient, onClose, onSaved }: EditModalProps) {
  const [name, setName] = useState(patient.name);
  const [phone, setPhone] = useState(patient.phone);
  const [email, setEmail] = useState(patient.email ?? "");
  const [age, setAge] = useState(patient.age?.toString() ?? "");
  const [sex, setSex] = useState<string>(patient.sex ?? "");
  const [address, setAddress] = useState(patient.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          age: age ? parseInt(age, 10) : undefined,
          sex: sex || undefined,
          address: address.trim() || undefined,
        }),
      });
      const data = (await res.json()) as ApiJson & {
        patient: Pick<PatientRow, "name" | "phone" | "email" | "age" | "sex" | "address">;
      };
      if (!data.success) {
        setError(data.error ?? "Failed to save");
        return;
      }
      onSaved({
        ...patient,
        name: data.patient.name,
        phone: data.patient.phone,
        email: data.patient.email,
        age: data.patient.age,
        sex: data.patient.sex,
        address: data.patient.address,
      });
      onClose();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border border-border-primary bg-surface-primary p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Edit Patient</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-hint hover:bg-surface-secondary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-xs text-text-hint">
          Patient ID: <span className="font-mono font-medium text-text-primary">{patient.patientId}</span>
        </p>

        {error && (
          <div className="mb-3 rounded-md bg-surface-error px-3 py-2 text-sm text-text-error">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <FormField label="Full Name" htmlFor="edit-name">
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </FormField>
          <FormField label="Phone" htmlFor="edit-phone">
            <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile" />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Age" htmlFor="edit-age">
              <Input id="edit-age" type="number" min={0} max={150} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Age" />
            </FormField>
            <FormField label="Sex" htmlFor="edit-sex">
              <select
                id="edit-sex"
                value={sex}
                onChange={(e) => setSex(e.target.value)}
                className="w-full rounded-md border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-brand focus:ring-1 focus:ring-focus-ring focus:outline-none"
              >
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </FormField>
          </div>
          <FormField label="Email" htmlFor="edit-email">
            <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
          </FormField>
          <FormField label="Address" htmlFor="edit-address">
            <Input id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
          </FormField>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ----- Delete Confirmation Modal -----

interface DeleteConfirmProps {
  count: number;
  deleting: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ count, deleting, error, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={deleting ? undefined : onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border-primary bg-surface-primary p-6 shadow-xl">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-error">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-text-error">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </div>
        <h2 className="mb-1 text-base font-semibold text-text-primary">
          Delete {count} patient{count !== 1 ? "s" : ""}?
        </h2>
        <p className="mb-4 text-sm text-text-secondary">
          This will permanently delete {count === 1 ? "this patient" : `these ${count} patients`} along with all their appointments and prescriptions. This action cannot be undone.
        </p>

        {error && (
          <div className="mb-3 rounded-md bg-surface-error px-3 py-2 text-sm text-text-error">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={deleting}>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-md bg-surface-error px-3 py-1.5 text-sm font-medium text-text-error transition-colors hover:opacity-80 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : `Delete ${count === 1 ? "Patient" : `${count} Patients`}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ----- Main View -----

export default function PatientsView({ initialPatients, initialTotal }: PatientsViewProps) {
  const [patients, setPatients] = useState<PatientRow[]>(initialPatients);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editingPatient, setEditingPatient] = useState<PatientRow | null>(null);
  const [loading, setLoading] = useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const selectAllRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchPage = useCallback(async (q: string, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("search", q.trim());
      params.set("page", String(p));
      params.set("limit", String(PAGE_SIZE));
      const res = await fetch(`/api/patients?${params}`);
      const data = (await res.json()) as ApiJson & { patients: PatientRow[]; total: number };
      if (data.success) {
        setPatients(data.patients);
        setTotal(data.total);
      }
    } catch (err) {
      console.error("Failed to fetch patients:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setSelectedIds(new Set());
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      fetchPage(value, 1);
    }, 400);
  }, [fetchPage]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchPage(search, newPage);
  };

  // Keep select-all checkbox indeterminate state in sync
  useEffect(() => {
    if (!selectAllRef.current) return;
    const count = patients.filter((p) => selectedIds.has(p.id)).length;
    selectAllRef.current.checked = count > 0 && count === patients.length;
    selectAllRef.current.indeterminate = count > 0 && count < patients.length;
  }, [selectedIds, patients]);

  const selectedCount = patients.filter((p) => selectedIds.has(p.id)).length;

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const visibleIds = patients.map((p) => p.id);
    const allSelected = visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    setDeleting(true);
    setDeleteError("");
    const ids = Array.from(selectedIds);
    try {
      const res = await fetch("/api/patients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = (await res.json()) as ApiJson;
      if (!data.success) {
        setDeleteError(data.error ?? "Delete failed");
        return;
      }
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
      fetchPage(search, page);
    } catch {
      setDeleteError("An unexpected error occurred.");
    } finally {
      setDeleting(false);
    }
  }

  function handleSaved(updated: PatientRow) {
    setPatients((prev) =>
      prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-hint"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <Input
            className="pl-9"
            placeholder="Search by name, phone, ID or email…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <span className="shrink-0 text-sm text-text-hint">
          <span className="font-medium text-text-secondary">{total}</span> total
        </span>
      </div>

      {/* Selection badge */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-border-primary bg-surface-primary px-4 py-2.5 shadow-sm">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-brand-subtle px-2 text-xs font-semibold text-text-brand">
            {selectedCount}
          </span>
          <span className="flex-1 text-sm text-text-secondary">
            patient{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            onClick={() => { setDeleteError(""); setShowDeleteConfirm(true); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-surface-error px-3 py-1.5 text-sm font-medium text-text-error transition-colors hover:opacity-80"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
            Delete
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded p-1 text-text-hint hover:bg-surface-secondary"
            aria-label="Clear selection"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm text-text-hint">Loading patients...</div>
      ) : patients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border-primary bg-surface-primary py-16 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mb-3 h-10 w-10 text-text-hint"
          >
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <p className="text-sm font-medium text-text-secondary">No patients found</p>
          {search && (
            <p className="mt-1 text-xs text-text-hint">
              Try a different name, phone number, or patient ID.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-primary bg-surface-primary">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary bg-surface-secondary">
                  <th className="px-4 py-3">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="Select all"
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-border-primary accent-text-brand"
                    />
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Patient ID
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Name
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Phone
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Age / Sex
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Email
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Visits
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Last Visit
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Outstanding
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-text-hint">
                    Registered
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {patients.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${isSelected ? "bg-surface-brand-subtle/40" : "hover:bg-surface-secondary/50"}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(p.id)}
                          aria-label={`Select ${p.name}`}
                          className="h-4 w-4 cursor-pointer rounded border-border-primary accent-text-brand"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-text-brand">
                        {p.patientId}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-text-primary">
                        {p.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {p.phone}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {p.age != null ? p.age : "—"}
                        {p.sex ? ` / ${SEX_LABELS[p.sex]}` : ""}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {p.email ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-text-secondary">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-brand-subtle px-2 text-xs font-medium text-text-brand">
                          {p.totalVisits}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">
                        {formatDate(p.lastVisit)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {p.outstanding > 0 ? (
                          <span className="font-medium text-text-error">
                            ₹{p.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-hint">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPatient(p)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination footer */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-tertiary">
          {total === 0
            ? "No patients"
            : `Showing ${start}–${end} of ${total} patient${total !== 1 ? "s" : ""}`}
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

      {editingPatient && (
        <EditModal
          patient={editingPatient}
          onClose={() => setEditingPatient(null)}
          onSaved={handleSaved}
        />
      )}

      {showDeleteConfirm && (
        <DeleteConfirmModal
          count={selectedCount}
          deleting={deleting}
          error={deleteError}
          onConfirm={handleBulkDelete}
          onCancel={() => { if (!deleting) setShowDeleteConfirm(false); }}
        />
      )}
    </div>
  );
}
