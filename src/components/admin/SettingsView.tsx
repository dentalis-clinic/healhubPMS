"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Input, FormField, Alert } from "@/components/ui";
import { useDashboard } from "./DashboardContext";
import type { DoctorRow } from "@/types/patient";
import SelectPatientModal from "./SelectPatientModal";
import TemplateFormModal from "./TemplateFormModal";
import ClinicSettingsTab from "./ClinicSettingsTab";

type TemplateType = "DOCUMENT" | "SURVEY";

interface PrintableTemplate {
  id: string;
  title: string;
  templateType: TemplateType;
  showPatientDetails: boolean;
  createdAt: string;
}

interface PrintableTemplateWithContent extends PrintableTemplate {
  content: string;
}

interface AdminRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

type ActiveTab = "clinic" | "doctors" | "admins" | "printables";

// --- Add Doctor Modal ---
function AddDoctorModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
  >({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });

    try {
      const res = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          qualifications: qualifications.trim() || undefined,
          registrationNumber: regNumber.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Failed to add doctor." });
        return;
      }

      onSaved();
      onClose();
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  }

  const loading = state.status === "loading";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border-primary bg-surface-primary p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Add Doctor</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {state.status === "error" && <Alert variant="error">{state.message}</Alert>}

          <FormField label="Name" htmlFor="add-doctor-name">
            <Input
              id="add-doctor-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              placeholder="Dr. Full Name"
              disabled={loading}
            />
          </FormField>

          <FormField label="Qualifications" htmlFor="add-doctor-qualifications" hint="Optional">
            <Input
              id="add-doctor-qualifications"
              type="text"
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              maxLength={500}
              placeholder="BDS, MDS (Prosthodontics)"
              disabled={loading}
            />
          </FormField>

          <FormField label="Registration Number" htmlFor="add-doctor-reg" hint="Optional">
            <Input
              id="add-doctor-reg"
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              maxLength={100}
              placeholder="DL-12345"
              disabled={loading}
            />
          </FormField>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading} loading={loading} loadingText="Adding...">
              Add Doctor
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Add Admin Modal ---
function AddAdminModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
  >({ status: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ status: "loading" });

    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Failed to create admin." });
        return;
      }

      onSaved();
      onClose();
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
    }
  }

  const loading = state.status === "loading";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border-primary bg-surface-primary p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Add Admin</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {state.status === "error" && <Alert variant="error">{state.message}</Alert>}

          <FormField label="Name" htmlFor="add-admin-name">
            <Input
              id="add-admin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              placeholder="Admin name"
              disabled={loading}
            />
          </FormField>

          <FormField label="Email" htmlFor="add-admin-email">
            <Input
              id="add-admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              disabled={loading}
            />
          </FormField>

          <FormField label="Password" htmlFor="add-admin-password">
            <Input
              id="add-admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Min. 6 characters"
              disabled={loading}
            />
          </FormField>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={loading} loading={loading} loadingText="Creating...">
              Create Admin
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Edit Admin Modal ---
function EditAdminModal({
  admin,
  onClose,
  onSaved,
}: {
  admin: AdminRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(admin.name);
  const [email, setEmail] = useState(admin.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to update admin.");
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border-primary bg-surface-primary p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Edit Admin</h3>

        <form onSubmit={handleSave} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <FormField label="Name" htmlFor="edit-admin-name">
            <Input
              id="edit-admin-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={100}
              disabled={saving}
            />
          </FormField>

          <FormField label="Email" htmlFor="edit-admin-email">
            <Input
              id="edit-admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={saving}
            />
          </FormField>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} loading={saving} loadingText="Saving...">
              Save
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Edit Doctor Modal ---
function EditDoctorModal({
  doctor,
  onClose,
  onSaved,
}: {
  doctor: DoctorRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(doctor.name);
  const [qualifications, setQualifications] = useState(doctor.qualifications ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(doctor.registrationNumber ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/doctors/${doctor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          qualifications: qualifications.trim() || undefined,
          registrationNumber: registrationNumber.trim() || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to update doctor.");
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border border-border-primary bg-surface-primary p-6 shadow-lg">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Edit Doctor</h3>

        <form onSubmit={handleSave} className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}

          <FormField label="Name" htmlFor="edit-doctor-name">
            <Input
              id="edit-doctor-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
              disabled={saving}
            />
          </FormField>

          <FormField label="Qualifications" htmlFor="edit-doctor-qualifications" hint="Optional">
            <Input
              id="edit-doctor-qualifications"
              type="text"
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              maxLength={500}
              disabled={saving}
            />
          </FormField>

          <FormField label="Registration Number" htmlFor="edit-doctor-reg" hint="Optional">
            <Input
              id="edit-doctor-reg"
              type="text"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              maxLength={100}
              disabled={saving}
            />
          </FormField>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={saving} loading={saving} loadingText="Saving...">
              Save
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Main Settings View ---
export default function SettingsView() {
  const { adminId: currentAdminId } = useDashboard();
  const [activeTab, setActiveTab] = useState<ActiveTab>("clinic");

  // Modal open state
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PrintableTemplateWithContent | null>(null);

  // Patient select modal state: stores which template to open after patient selection
  const [selectPatientFor, setSelectPatientFor] = useState<{ templateId: string } | null>(null);

  // --- Admin state ---
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [resetStatus, setResetStatus] = useState<{
    id: string;
    status: "loading" | "success" | "error";
    message?: string;
  } | null>(null);

  // --- Doctor state ---
  const [doctors, setDoctors] = useState<DoctorRow[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [editingDoctor, setEditingDoctor] = useState<DoctorRow | null>(null);
  const [deletingDoctorId, setDeletingDoctorId] = useState<string | null>(null);
  const [doctorDeleteError, setDoctorDeleteError] = useState("");

  // --- Printable templates state ---
  const [templates, setTemplates] = useState<PrintableTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [templateDeleteError, setTemplateDeleteError] = useState("");
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      setLoadingAdmins(true);
      const res = await fetch("/api/admin");
      const data = await res.json();
      if (data.success) setAdmins(data.admins);
    } catch (err) {
      console.error("Failed to fetch admins:", err);
    } finally {
      setLoadingAdmins(false);
    }
  }, []);

  const fetchDoctors = useCallback(async () => {
    try {
      setLoadingDoctors(true);
      const res = await fetch("/api/doctors?includeInactive=true");
      const data = await res.json();
      if (data.success) setDoctors(data.doctors);
    } catch (err) {
      console.error("Failed to fetch doctors:", err);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetch("/api/printable-templates");
      const data = await res.json();
      if (data.success) setTemplates(data.templates);
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchDoctors();
    fetchTemplates();
  }, [fetchAdmins, fetchDoctors, fetchTemplates]);

  async function handleDeleteTemplate(id: string) {
    setTemplateDeleteError("");
    setDeletingTemplateId(id);
    try {
      const res = await fetch(`/api/printable-templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setTemplateDeleteError(data.error ?? "Failed to delete document.");
        setDeletingTemplateId(null);
        return;
      }
      setConfirmDeleteTemplateId(null);
      setDeletingTemplateId(null);
      fetchTemplates();
    } catch {
      setTemplateDeleteError("Network error. Please try again.");
      setDeletingTemplateId(null);
    }
  }

  function handlePrintClick(templateId: string, showPatientDetails: boolean) {
    if (showPatientDetails) {
      setSelectPatientFor({ templateId });
    } else {
      window.open(
        `/admin/dashboard/prescription/template/${templateId}`,
        "_blank",
        "noopener,noreferrer"
      );
    }
  }

  async function handleDeleteAdmin(id: string) {
    setDeleteError("");
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error ?? "Failed to delete admin.");
        setDeletingId(null);
        return;
      }
      setDeletingId(null);
      fetchAdmins();
    } catch {
      setDeleteError("Network error. Please try again.");
      setDeletingId(null);
    }
  }

  async function handleResetPassword(id: string) {
    setResetStatus({ id, status: "loading" });
    try {
      const res = await fetch(`/api/admin/${id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResetStatus({ id, status: "error", message: data.error ?? "Failed to send reset email." });
        return;
      }
      setResetStatus({ id, status: "success", message: data.message });
      setTimeout(() => setResetStatus(null), 3000);
    } catch {
      setResetStatus({ id, status: "error", message: "Network error." });
    }
  }

  async function handleDeleteDoctor(id: string) {
    setDoctorDeleteError("");
    setDeletingDoctorId(id);
    try {
      const res = await fetch(`/api/doctors/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDoctorDeleteError(data.error ?? "Failed to delete doctor.");
        setDeletingDoctorId(null);
        return;
      }
      setDeletingDoctorId(null);
      fetchDoctors();
    } catch {
      setDoctorDeleteError("Network error. Please try again.");
      setDeletingDoctorId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab bar + action */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex rounded-md border border-border-primary bg-surface-secondary p-0.5">
          {(
            [
              { value: "clinic", label: "Clinic" },
              { value: "doctors", label: "Doctors" },
              { value: "admins", label: "Admins" },
              { value: "printables", label: "Printables" },
            ] as { value: ActiveTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
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

        {activeTab === "doctors" && (
          <Button size="sm" onClick={() => setShowAddDoctor(true)}>
            Add Doctor
          </Button>
        )}
        {activeTab === "admins" && (
          <Button size="sm" onClick={() => setShowAddAdmin(true)}>
            Add Admin
          </Button>
        )}
        {activeTab === "printables" && (
          <Button size="sm" onClick={() => setShowNewTemplate(true)}>
            New Document
          </Button>
        )}
        {/* Clinic tab has no top-level action — save buttons are per-section */}
      </div>

      {/* Clinic tab */}
      {activeTab === "clinic" && <ClinicSettingsTab />}

      {/* Doctors tab */}
      {activeTab === "doctors" && (
        <div>
          {doctorDeleteError && (
            <Alert variant="error" className="mb-3">
              {doctorDeleteError}
            </Alert>
          )}

          {loadingDoctors ? (
            <div className="py-8 text-center text-sm text-text-hint">Loading doctors...</div>
          ) : doctors.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-hint">
              No doctors added yet.{" "}
              <button
                onClick={() => setShowAddDoctor(true)}
                className="text-text-brand underline underline-offset-2"
              >
                Add one now.
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-primary">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-primary bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Qualifications</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-text-secondary sm:table-cell">
                      Reg. Number
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doctor) => (
                    <tr
                      key={doctor.id}
                      className={`border-b border-border-primary last:border-0 ${
                        !doctor.isActive ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 text-text-primary">
                        {doctor.name}
                        {!doctor.isActive && (
                          <span className="ml-2 rounded bg-surface-error/10 px-1.5 py-0 text-[10px] font-medium text-text-error">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">
                        {doctor.qualifications || "-"}
                      </td>
                      <td className="hidden px-4 py-2.5 text-text-hint sm:table-cell">
                        {doctor.registrationNumber || "-"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingDoctor(doctor)}
                            className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                          >
                            Edit
                          </button>
                          {doctor.isActive && (
                            <button
                              onClick={() => handleDeleteDoctor(doctor.id)}
                              disabled={deletingDoctorId === doctor.id}
                              className="rounded px-2 py-1 text-xs font-medium text-text-error hover:bg-surface-error/10 disabled:opacity-50"
                            >
                              {deletingDoctorId === doctor.id ? "Removing..." : "Remove"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Admins tab */}
      {activeTab === "admins" && (
        <div>
          {deleteError && (
            <Alert variant="error" className="mb-3">
              {deleteError}
            </Alert>
          )}

          {loadingAdmins ? (
            <div className="py-8 text-center text-sm text-text-hint">Loading admins...</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border-primary">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-primary bg-surface-secondary">
                    <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Name</th>
                    <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Email</th>
                    <th className="hidden px-4 py-2.5 text-left font-medium text-text-secondary sm:table-cell">
                      Created
                    </th>
                    <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => {
                    const isSelf = admin.id === currentAdminId;
                    return (
                      <tr key={admin.id} className="border-b border-border-primary last:border-0">
                        <td className="px-4 py-2.5 text-text-primary">
                          {admin.name}
                          {isSelf && (
                            <span className="ml-2 rounded bg-surface-brand-subtle px-1.5 py-0 text-[10px] font-medium text-text-brand">
                              You
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-text-secondary">{admin.email}</td>
                        <td className="hidden px-4 py-2.5 text-text-hint sm:table-cell">
                          {new Date(admin.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingAdmin(admin)}
                              className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleResetPassword(admin.id)}
                              disabled={
                                resetStatus?.id === admin.id && resetStatus.status === "loading"
                              }
                              className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary disabled:opacity-50"
                            >
                              {resetStatus?.id === admin.id && resetStatus.status === "loading"
                                ? "Sending..."
                                : resetStatus?.id === admin.id && resetStatus.status === "success"
                                  ? "Sent!"
                                  : "Reset Password"}
                            </button>
                            {!isSelf && (
                              <button
                                onClick={() => handleDeleteAdmin(admin.id)}
                                disabled={deletingId === admin.id}
                                className="rounded px-2 py-1 text-xs font-medium text-text-error hover:bg-surface-error/10 disabled:opacity-50"
                              >
                                {deletingId === admin.id ? "Deleting..." : "Delete"}
                              </button>
                            )}
                          </div>
                          {resetStatus?.id === admin.id && resetStatus.status === "error" && (
                            <p className="mt-1 text-right text-xs text-text-error">
                              {resetStatus.message}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Printables tab */}
      {activeTab === "printables" && (
        <div className="space-y-3">
          {templateDeleteError && (
            <Alert variant="error">{templateDeleteError}</Alert>
          )}

          {loadingTemplates ? (
            <div className="py-8 text-center text-sm text-text-hint">Loading documents…</div>
          ) : templates.length === 0 ? (
            <div className="py-12 text-center text-sm text-text-hint">
              No documents yet.{" "}
              <button
                onClick={() => setShowNewTemplate(true)}
                className="text-text-brand underline underline-offset-2"
              >
                Create one.
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="flex flex-col gap-3 rounded-lg border border-border-primary bg-surface-primary p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface-secondary text-base">
                      {tmpl.templateType === "SURVEY" ? "📋" : "📄"}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{tmpl.title}</p>
                      <p className="mt-0.5 text-xs text-text-hint">
                        {tmpl.templateType === "SURVEY"
                          ? "Screening survey (Yes / No)"
                          : tmpl.showPatientDetails
                            ? "Includes patient details"
                            : "No patient details"}
                      </p>
                    </div>
                  </div>

                  {confirmDeleteTemplateId === tmpl.id ? (
                    <div className="rounded-md bg-surface-error/10 p-2 text-xs">
                      <p className="mb-2 font-medium text-text-error">Delete this document?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id)}
                          disabled={deletingTemplateId === tmpl.id}
                          className="rounded bg-text-error px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {deletingTemplateId === tmpl.id ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteTemplateId(null)}
                          className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => handlePrintClick(tmpl.id, tmpl.showPatientDetails)}
                      >
                        Print
                      </Button>
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/printable-templates/${tmpl.id}`);
                          const data = await res.json();
                          if (data.success) setEditingTemplate(data.template);
                        }}
                        className="rounded px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDeleteTemplateId(tmpl.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-text-error hover:bg-surface-error/10"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddDoctor && (
        <AddDoctorModal onClose={() => setShowAddDoctor(false)} onSaved={fetchDoctors} />
      )}
      {showAddAdmin && (
        <AddAdminModal onClose={() => setShowAddAdmin(false)} onSaved={fetchAdmins} />
      )}
      {editingAdmin && (
        <EditAdminModal
          admin={editingAdmin}
          onClose={() => setEditingAdmin(null)}
          onSaved={fetchAdmins}
        />
      )}
      {editingDoctor && (
        <EditDoctorModal
          doctor={editingDoctor}
          onClose={() => setEditingDoctor(null)}
          onSaved={fetchDoctors}
        />
      )}
      {showNewTemplate && (
        <TemplateFormModal
          onClose={() => setShowNewTemplate(false)}
          onSaved={fetchTemplates}
        />
      )}
      {editingTemplate && (
        <TemplateFormModal
          initial={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={fetchTemplates}
        />
      )}
      {selectPatientFor && (
        <SelectPatientModal
          title="Select Patient to Print For"
          onClose={() => setSelectPatientFor(null)}
          onSelect={(patient) => {
            window.open(
              `/admin/dashboard/prescription/template/${selectPatientFor.templateId}?patientId=${patient.id}`,
              "_blank",
              "noopener,noreferrer"
            );
            setSelectPatientFor(null);
          }}
        />
      )}
    </div>
  );
}
