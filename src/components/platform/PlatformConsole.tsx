"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Alert, Badge, Button, Input } from "@/components/ui";
import type { ApiJson } from "@/types/api";
import { ClinicAdminsPanel } from "./ClinicAdminsPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { formatDate, formatRelative } from "./format";
import type { PlatformClinic } from "./types";

interface PlatformConsoleProps {
  adminName: string;
  adminEmail: string;
}

const numberFormat = new Intl.NumberFormat("en-IN");

export function PlatformConsole({ adminName, adminEmail }: PlatformConsoleProps) {
  const router = useRouter();
  const [clinics, setClinics] = useState<PlatformClinic[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<PlatformClinic | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/platform/clinics");
      const json = (await res.json()) as ApiJson & { clinics?: PlatformClinic[] };
      if (!res.ok || !json.clinics) throw new Error(json.error ?? "Couldn't load clinics.");
      setClinics(json.clinics);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load clinics.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (!clinics) return [];
    const q = query.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q)
    );
  }, [clinics, query]);

  const totals = useMemo(() => {
    const list = clinics ?? [];
    return {
      clinics: list.length,
      active: list.filter((c) => c.isActive).length,
      patients: list.reduce((sum, c) => sum + c.patientCount, 0),
    };
  }, [clinics]);

  // Stable so ClinicAdminsPanel's load effect doesn't re-run on every render.
  const updateAdminCount = useCallback((clinicId: string, count: number) => {
    setClinics((list) =>
      list ? list.map((c) => (c.id === clinicId ? { ...c, adminCount: count } : c)) : list
    );
  }, []);

  async function handleStatusChange() {
    if (!statusTarget) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/platform/clinics/${statusTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !statusTarget.isActive }),
      });
      const json = (await res.json()) as ApiJson;
      if (!res.ok) throw new Error(json.error ?? "Couldn't update the clinic.");
      setClinics((list) =>
        list ? list.map((c) => (c.id === statusTarget.id ? { ...c, isActive: !c.isActive } : c)) : list
      );
      setStatusTarget(null);
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Couldn't update the clinic.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/platform/login");
    router.refresh();
  }

  const deactivating = statusTarget?.isActive ?? false;

  return (
    <div className="min-h-dvh bg-surface-secondary">
      <header className="border-b border-border-primary bg-surface-primary">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <p className="text-sm font-semibold text-text-primary">
            HealthHub <span className="font-normal text-text-tertiary">/ Platform</span>
          </p>
          <div className="flex items-center gap-3">
            <p className="hidden truncate text-sm text-text-secondary sm:block" title={adminEmail}>
              {adminName}
            </p>
            <Button size="sm" variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text-primary text-balance">Clinics</h1>
            <p className="mt-1 text-sm text-text-secondary tabular-nums">
              {clinics === null
                ? "Loading…"
                : `${totals.clinics} ${totals.clinics === 1 ? "clinic" : "clinics"} · ${totals.active} active · ${numberFormat.format(totals.patients)} patients in total`}
            </p>
          </div>
          <div className="w-full sm:w-64">
            <label htmlFor="clinic-search" className="sr-only">
              Search clinics
            </label>
            <Input
              id="clinic-search"
              type="search"
              placeholder="Search name, subdomain, email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {loadError && (
          <Alert variant="error">
            {loadError}{" "}
            <button type="button" onClick={load} className="font-medium underline">
              Try again
            </button>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-lg border border-border-primary bg-surface-primary">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-border-primary text-xs font-medium text-text-tertiary">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Clinic</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Admins</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Patients</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Appointments</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Joined</th>
                <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {clinics === null &&
                !loadError &&
                [0, 1, 2].map((i) => (
                  <tr key={i} aria-hidden="true">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-9 rounded-md bg-surface-tertiary" />
                    </td>
                  </tr>
                ))}

              {clinics !== null && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-secondary">
                    {clinics.length === 0 ? (
                      <>
                        No clinics yet.{" "}
                        <a href="/register" className="font-medium text-text-link hover:underline">
                          Register the first one
                        </a>
                      </>
                    ) : (
                      <>
                        No clinics match &ldquo;{query}&rdquo;.{" "}
                        <button type="button" onClick={() => setQuery("")} className="font-medium text-text-link hover:underline">
                          Clear search
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}

              {visible.map((clinic) => {
                const expanded = expandedId === clinic.id;
                return (
                  <Fragment key={clinic.id}>
                    <tr className={clinic.isActive ? "" : "bg-surface-secondary"}>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${clinic.isActive ? "text-text-primary" : "text-text-secondary"}`}>
                          {clinic.name}
                        </p>
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          <span className="font-mono">{clinic.slug}</span> · {formatRelative(clinic.lastAppointmentAt)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={clinic.isActive ? "success" : "neutral"}>
                          {clinic.isActive ? "Active" : "Deactivated"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{clinic.adminCount}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                        {numberFormat.format(clinic.patientCount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                        {numberFormat.format(clinic.appointmentCount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-text-secondary tabular-nums">
                        {formatDate(clinic.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-expanded={expanded}
                            aria-controls={`clinic-admins-${clinic.id}`}
                            onClick={() => setExpandedId(expanded ? null : clinic.id)}
                          >
                            {expanded ? "Hide admins" : "Admins"}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setStatusTarget(clinic)}>
                            {clinic.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr id={`clinic-admins-${clinic.id}`}>
                        <td colSpan={7} className="bg-surface-secondary px-4 py-4">
                          <ClinicAdminsPanel
                            clinicId={clinic.id}
                            clinicName={clinic.name}
                            onAdminCountChange={updateAdminCount}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      <ConfirmDialog
        open={statusTarget !== null}
        tone={deactivating ? "danger" : "default"}
        title={deactivating ? `Deactivate ${statusTarget?.name ?? ""}?` : `Activate ${statusTarget?.name ?? ""}?`}
        confirmLabel={deactivating ? "Deactivate clinic" : "Activate clinic"}
        busyLabel={deactivating ? "Deactivating…" : "Activating…"}
        busy={statusBusy}
        error={statusError}
        onConfirm={handleStatusChange}
        onClose={() => {
          setStatusTarget(null);
          setStatusError(null);
        }}
      >
        {deactivating ? (
          <p>
            Their booking page stops working and their admins are locked out straight away. Nothing is deleted;
            you can activate the clinic again at any time.
          </p>
        ) : (
          <p>Their booking page and admin dashboard start working again straight away.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
