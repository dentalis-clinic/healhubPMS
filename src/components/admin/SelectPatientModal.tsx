"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui";
import type { ApiJson } from "@/types/api";

interface PatientResult {
  id: string;
  patientId: string;
  name: string;
  phone: string;
  age: number | null;
  sex: string | null;
}

interface SelectPatientModalProps {
  onClose: () => void;
  onSelect: (patient: PatientResult) => void;
  title?: string;
}

export default function SelectPatientModal({
  onClose,
  onSelect,
  title = "Select Patient",
}: SelectPatientModalProps) {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPatients(search), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Load initial list on mount
  useEffect(() => {
    fetchPatients("");
  }, []);

  async function fetchPatients(q: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("search", q);
      const res = await fetch(`/api/patients?${params}`);
      const data = (await res.json()) as ApiJson & { patients: PatientResult[]; total: number };
      if (data.success) {
        setPatients(data.patients);
        setTotal(data.total);
      }
    } catch {
      // silently fail — list stays as-is
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-surface-overlay/30" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-md flex-col rounded-lg border border-border-primary bg-surface-primary shadow-lg"
           style={{ maxHeight: "80vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-5 py-4">
          <h3 className="text-base font-semibold text-text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-hint hover:bg-surface-secondary hover:text-text-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border-primary px-5 py-3">
          <Input
            type="text"
            placeholder="Search by name, phone, or patient ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        {/* Patient list */}
        <div className="flex-1 overflow-y-auto">
          {loading && patients.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-hint">Loading…</div>
          ) : patients.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-hint">No patients found.</div>
          ) : (
            <>
              <ul className="divide-y divide-border-primary">
                {patients.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => onSelect(p)}
                      className="w-full px-5 py-3 text-left transition-colors hover:bg-surface-secondary"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-text-primary">{p.name}</p>
                          <p className="text-xs text-text-hint">{p.phone}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-xs text-text-secondary">{p.patientId}</p>
                          {(p.age != null || p.sex) && (
                            <p className="text-xs text-text-hint">
                              {p.age != null ? `${p.age}y` : ""}
                              {p.age != null && p.sex ? " · " : ""}
                              {p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase() : ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              {total > patients.length && (
                <p className="px-5 py-2 text-center text-xs text-text-hint">
                  Showing {patients.length} of {total} — refine your search to find more.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
