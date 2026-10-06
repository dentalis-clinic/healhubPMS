"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, FormField, Alert } from "@/components/ui";
import { APP_DOMAIN, isTestHost } from "@/lib/constants/app";

// ── Constants ────────────────────────────────────────────────────────────────

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
];

const STEPS = [
  { id: 1, label: "Clinic" },
  { id: 2, label: "Contact" },
  { id: 3, label: "Logo" },
  { id: 4, label: "Admin" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toAcronym(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 8);
}

function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 30)
    .replace(/^-|-$/g, "");
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

// ── Types ────────────────────────────────────────────────────────────────────

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface WizardData {
  name: string;
  shortName: string;
  slug: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  phones: string[];
  email: string;
  website: string;
  timezone: string;
  logoFile: File | null;
  logoPreview: string | null;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirm: string;
}

const initialData: WizardData = {
  name: "",
  shortName: "",
  slug: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  phones: [""],
  email: "",
  website: "",
  timezone: "Asia/Kolkata",
  logoFile: null,
  logoPreview: null,
  adminName: "",
  adminEmail: "",
  adminPassword: "",
  adminPasswordConfirm: "",
};

// ── Step components ──────────────────────────────────────────────────────────

function StepClinicIdentity({
  data,
  update,
  slugStatus,
  slugMessage,
}: {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
  slugStatus: SlugStatus;
  slugMessage: string;
}) {
  function handleNameChange(name: string) {
    const shortName = toAcronym(name);
    const slug = toSlug(name);
    update({ name, shortName, slug });
  }

  const slugIndicator = {
    idle: null,
    checking: (
      <span className="text-text-hint text-xs">Checking availability…</span>
    ),
    available: (
      <span className="text-text-success text-xs flex items-center gap-1">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm3.354 5.146a.5.5 0 0 0-.708 0L7 9.793 5.354 8.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l4-4a.5.5 0 0 0 0-.708z" />
        </svg>
        Available
      </span>
    ),
    taken: (
      <span className="text-text-error text-xs flex items-center gap-1">
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm2.146 4.146a.5.5 0 0 1 .708.708L8.707 8l2.147 2.146a.5.5 0 0 1-.708.708L8 8.707l-2.146 2.147a.5.5 0 0 1-.708-.708L7.293 8 5.146 5.854a.5.5 0 0 1 .708-.708L8 7.293l2.146-2.147z" />
        </svg>
        {slugMessage}
      </span>
    ),
    invalid: (
      <span className="text-text-error text-xs">{slugMessage}</span>
    ),
  }[slugStatus];

  return (
    <div className="space-y-5">
      <FormField label="Clinic name" htmlFor="name" hint="Your clinic's full legal or operating name">
        <Input
          id="name"
          value={data.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Dentalis Dental Care by Jamians"
          autoFocus
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Patient ID prefix"
          htmlFor="shortName"
          hint="Used in patient IDs e.g. DDCJ-20240101-0001"
        >
          <Input
            id="shortName"
            value={data.shortName}
            onChange={(e) => update({ shortName: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) })}
            placeholder="DDCJ"
            className="font-mono tracking-widest"
          />
        </FormField>

        <FormField label="Subdomain" htmlFor="slug">
          <Input
            id="slug"
            value={data.slug}
            onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) })}
            placeholder="ddcj"
            className="font-mono"
          />
        </FormField>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border-primary bg-surface-brand px-4 py-3">
        <div>
          <p className="text-xs text-text-secondary font-medium">Your dashboard URL</p>
          <p className="text-sm font-mono text-text-brand mt-0.5">
            {data.slug ? (
              <span>
                <span className="text-text-primary font-semibold">{data.slug}</span>
                <span className="text-text-hint">.{APP_DOMAIN}</span>
              </span>
            ) : (
              <span className="text-text-hint">yourslug.{APP_DOMAIN}</span>
            )}
          </p>
        </div>
        <div className="text-right">{slugIndicator}</div>
      </div>
    </div>
  );
}

function StepContact({
  data,
  update,
}: {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
}) {
  function updatePhone(idx: number, value: string) {
    const phones = [...data.phones];
    phones[idx] = normalizePhone(value);
    update({ phones });
  }

  function addPhone() {
    if (data.phones.length < 3) update({ phones: [...data.phones, ""] });
  }

  function removePhone(idx: number) {
    update({ phones: data.phones.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-text-label mb-3">Phone numbers</p>
        <div className="space-y-2">
          {data.phones.map((phone, idx) => (
            <div key={idx} className="flex gap-2">
              <Input
                value={phone}
                onChange={(e) => updatePhone(idx, e.target.value)}
                placeholder="9876543210"
                inputMode="tel"
                maxLength={10}
                className="font-mono"
              />
              {data.phones.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePhone(idx)}
                  className="flex-shrink-0 text-text-tertiary hover:text-text-error transition-colors px-2"
                  aria-label="Remove phone"
                >
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm2.146 4.146a.5.5 0 0 1 .708.708L8.707 8l2.147 2.146a.5.5 0 0 1-.708.708L8 8.707l-2.146 2.147a.5.5 0 0 1-.708-.708L7.293 8 5.146 5.854a.5.5 0 0 1 .708-.708L8 7.293l2.146-2.147z" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          {data.phones.length < 3 && (
            <button
              type="button"
              onClick={addPhone}
              className="text-sm text-text-link hover:text-text-brand transition-colors"
            >
              + Add another number
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Contact email" htmlFor="email">
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={(e) => update({ email: e.target.value })}
            placeholder="clinic@example.com"
          />
        </FormField>

        <FormField label="Website" htmlFor="website">
          <Input
            id="website"
            type="url"
            value={data.website}
            onChange={(e) => update({ website: e.target.value })}
            placeholder="https://example.com"
          />
        </FormField>
      </div>

      <div>
        <p className="text-sm font-medium text-text-label mb-3">Address <span className="text-text-tertiary font-normal">(optional)</span></p>
        <div className="space-y-3">
          <Input
            value={data.addressLine1}
            onChange={(e) => update({ addressLine1: e.target.value })}
            placeholder="Street address"
          />
          <Input
            value={data.addressLine2}
            onChange={(e) => update({ addressLine2: e.target.value })}
            placeholder="Apartment, floor, building (optional)"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              value={data.city}
              onChange={(e) => update({ city: e.target.value })}
              placeholder="City"
            />
            <select
              value={data.state}
              onChange={(e) => update({ state: e.target.value })}
              className="block w-full rounded-md border border-border-secondary bg-surface-primary px-3 py-2 text-sm text-text-primary focus:border-border-focus focus:ring-1 focus:ring-focus-ring focus:outline-none"
            >
              <option value="">State</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <Input
            value={data.pincode}
            onChange={(e) => update({ pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })}
            placeholder="Pincode"
            inputMode="numeric"
            maxLength={6}
            className="w-40"
          />
        </div>
      </div>
    </div>
  );
}

function StepLogo({
  data,
  update,
}: {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const preview = URL.createObjectURL(file);
    update({ logoFile: file, logoPreview: preview });
  }

  function clearLogo() {
    if (data.logoPreview) URL.revokeObjectURL(data.logoPreview);
    update({ logoFile: null, logoPreview: null });
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-text-secondary">
        Upload your clinic logo to personalise the dashboard and printable documents. You can skip this now and add it later.
      </p>

      {data.logoPreview ? (
        <div className="flex items-center gap-4 rounded-lg border border-border-primary bg-surface-secondary p-4">
          <img
            src={data.logoPreview}
            alt="Logo preview"
            className="h-16 w-auto max-w-[120px] object-contain rounded"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{data.logoFile?.name}</p>
            <p className="text-xs text-text-hint mt-0.5">
              {data.logoFile ? (data.logoFile.size / 1024).toFixed(0) + " KB" : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={clearLogo}
            className="text-sm text-text-error hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-xl border-2 border-dashed border-border-secondary hover:border-border-focus hover:bg-surface-brand transition-colors p-10 flex flex-col items-center gap-3 group"
        >
          <svg
            className="w-10 h-10 text-text-tertiary group-hover:text-text-brand transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-text-secondary group-hover:text-text-brand">Click to upload</p>
            <p className="text-xs text-text-hint mt-1">PNG, JPG, SVG up to 2 MB</p>
          </div>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}

function StepAdmin({
  data,
  update,
}: {
  data: WizardData;
  update: (patch: Partial<WizardData>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const passwordsMatch = data.adminPassword === data.adminPasswordConfirm;
  const confirmTouched = data.adminPasswordConfirm.length > 0;

  return (
    <div className="space-y-5">
      <FormField label="Your name" htmlFor="adminName">
        <Input
          id="adminName"
          value={data.adminName}
          onChange={(e) => update({ adminName: e.target.value })}
          placeholder="Dr. Jamian Ahmed"
          autoFocus
        />
      </FormField>

      <FormField label="Email address" htmlFor="adminEmail" hint="You'll use this to sign in">
        <Input
          id="adminEmail"
          type="email"
          value={data.adminEmail}
          onChange={(e) => update({ adminEmail: e.target.value })}
          placeholder="admin@example.com"
          autoComplete="new-email"
        />
      </FormField>

      <FormField label="Password" htmlFor="adminPassword" hint="Minimum 8 characters">
        <div className="relative">
          <Input
            id="adminPassword"
            type={showPassword ? "text" : "password"}
            value={data.adminPassword}
            onChange={(e) => update({ adminPassword: e.target.value })}
            placeholder="••••••••"
            autoComplete="new-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
              </svg>
            )}
          </button>
        </div>
      </FormField>

      <FormField label="Confirm password" htmlFor="adminPasswordConfirm">
        <Input
          id="adminPasswordConfirm"
          type={showPassword ? "text" : "password"}
          value={data.adminPasswordConfirm}
          onChange={(e) => update({ adminPasswordConfirm: e.target.value })}
          placeholder="••••••••"
          autoComplete="new-password"
          className={confirmTouched && !passwordsMatch ? "border-border-error" : ""}
        />
        {confirmTouched && !passwordsMatch && (
          <p className="text-xs text-text-error mt-1">Passwords don&apos;t match</p>
        )}
      </FormField>

      {/* Review summary */}
      <div className="rounded-lg border border-border-primary bg-surface-secondary p-4 space-y-2">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Summary</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-text-hint">Clinic</dt>
          <dd className="text-text-primary font-medium truncate">{data.name || "—"}</dd>
          <dt className="text-text-hint">Subdomain</dt>
          <dd className="text-text-primary font-mono">{data.slug ? `${data.slug}.${APP_DOMAIN}` : "—"}</dd>
          <dt className="text-text-hint">Prefix</dt>
          <dd className="text-text-primary font-mono">{data.shortName || "—"}</dd>
          <dt className="text-text-hint">Phone</dt>
          <dd className="text-text-primary">{data.phones.filter(Boolean).join(", ") || "—"}</dd>
        </dl>
      </div>
    </div>
  );
}

// ── Progress indicator ───────────────────────────────────────────────────────

function StepProgress({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, idx) => {
        const done = step.id < currentStep;
        const active = step.id === currentStep;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  done
                    ? "bg-interactive-primary text-text-inverse"
                    : active
                    ? "border-2 border-interactive-primary text-text-brand bg-surface-brand"
                    : "border-2 border-border-primary text-text-tertiary bg-surface-primary"
                }`}
              >
                {done ? (
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M12.354 4.646a.5.5 0 0 1 0 .708l-5.5 5.5a.5.5 0 0 1-.708 0l-2.5-2.5a.5.5 0 1 1 .708-.708L6.5 9.793l5.146-5.147a.5.5 0 0 1 .708 0z" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`text-xs ${
                  active ? "text-text-brand font-medium" : "text-text-tertiary"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px mx-3 mb-5 transition-colors ${
                  done ? "bg-interactive-primary" : "bg-border-primary"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Success screen ───────────────────────────────────────────────────────────

function SuccessScreen({ slug }: { slug: string }) {
  // Test hosts serve DEFAULT_CLINIC_SLUG on the same origin — no clinic subdomain.
  const loginUrl =
    typeof window !== "undefined" && isTestHost(window.location.hostname)
      ? `${window.location.origin}/admin/login`
      : `https://${slug}.${APP_DOMAIN}/admin/login`;

  return (
    <div className="text-center space-y-6">
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-full bg-surface-success flex items-center justify-center">
          <svg className="w-8 h-8 text-text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      </div>
      <div>
        <h2 className="text-heading-2 font-bold text-text-primary">Your clinic is live</h2>
        <p className="text-body-sm text-text-secondary mt-2">
          Everything is set up. Sign in to your dashboard to start managing appointments.
        </p>
      </div>
      <div className="rounded-lg border border-border-primary bg-surface-secondary p-4 text-left">
        <p className="text-xs text-text-hint mb-1">Your login URL</p>
        <p className="text-sm font-mono text-text-brand break-all">{loginUrl}</p>
      </div>
      <a
        href={loginUrl}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-interactive-primary px-6 py-2.5 text-sm font-medium text-text-inverse hover:bg-interactive-primary-hover transition-colors"
      >
        Login to continue
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </a>
    </div>
  );
}

// ── Validation per step ──────────────────────────────────────────────────────

function validateStep(step: number, data: WizardData, slugStatus: SlugStatus): string | null {
  if (step === 1) {
    if (!data.name.trim()) return "Clinic name is required";
    if (data.shortName.length < 2) return "Patient ID prefix must be at least 2 characters";
    if (data.slug.length < 3) return "Subdomain must be at least 3 characters";
    if (slugStatus === "taken") return "This subdomain is already taken";
    if (slugStatus === "invalid") return "Subdomain format is invalid";
    if (slugStatus === "checking") return "Please wait while we check slug availability";
    return null;
  }
  if (step === 2) {
    if (!data.phones.some((p) => /^[6-9]\d{9}$/.test(p))) {
      return "At least one valid 10-digit mobile number is required";
    }
    return null;
  }
  if (step === 3) return null; // logo is optional
  if (step === 4) {
    if (!data.adminName.trim()) return "Your name is required";
    if (!data.adminEmail) return "Email address is required";
    if (data.adminPassword.length < 8) return "Password must be at least 8 characters";
    if (data.adminPassword !== data.adminPasswordConfirm) return "Passwords don't match";
    return null;
  }
  return null;
}

// ── Main wizard ──────────────────────────────────────────────────────────────

export default function RegisterWizard() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [slugMessage, setSlugMessage] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [createdSlug, setCreatedSlug] = useState("");

  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((patch: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    setStepError(null);
  }, []);

  // Debounced slug availability check
  useEffect(() => {
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);

    const slug = data.slug;
    if (!slug || slug.length < 3) {
      setSlugStatus("idle");
      return;
    }

    setSlugStatus("checking");
    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/onboarding/check-slug?slug=${encodeURIComponent(slug)}`);
        const json = await res.json() as { available: boolean; valid: boolean; message?: string };
        if (!json.valid) {
          setSlugStatus("invalid");
          setSlugMessage(json.message ?? "Invalid format");
        } else if (json.available) {
          setSlugStatus("available");
        } else {
          setSlugStatus("taken");
          setSlugMessage(json.message ?? "Already taken");
        }
      } catch {
        setSlugStatus("idle");
      }
    }, 400);

    return () => {
      if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    };
  }, [data.slug]);

  function goNext() {
    const err = validateStep(step, data, slugStatus);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setStep((s) => s + 1);
  }

  function goBack() {
    setStepError(null);
    setStep((s) => s - 1);
  }

  async function handleSubmit() {
    const err = validateStep(4, data, slugStatus);
    if (err) {
      setStepError(err);
      return;
    }

    setSubmitting(true);
    setGlobalError(null);

    try {
      // Upload logo if provided
      let logoUrl: string | undefined;
      if (data.logoFile) {
        const supabase = createClient();
        const ext = data.logoFile.name.split(".").pop() ?? "png";
        const path = `${data.slug}-${Date.now()}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("clinic-logos")
          .upload(path, data.logoFile, { contentType: data.logoFile.type, upsert: false });

        if (uploadError) throw new Error("Logo upload failed: " + uploadError.message);

        const { data: urlData } = supabase.storage.from("clinic-logos").getPublicUrl(uploadData.path);
        logoUrl = urlData.publicUrl;
      }

      const payload = {
        clinic: {
          name: data.name,
          shortName: data.shortName,
          slug: data.slug,
          timezone: data.timezone,
          phones: data.phones.filter((p) => /^[6-9]\d{9}$/.test(p)),
          email: data.email || undefined,
          website: data.website || undefined,
          logo: logoUrl,
          ...(data.addressLine1
            ? {
                address: {
                  line1: data.addressLine1,
                  line2: data.addressLine2 || undefined,
                  city: data.city,
                  state: data.state,
                  pincode: data.pincode,
                },
              }
            : {}),
        },
        admin: {
          name: data.adminName,
          email: data.adminEmail,
          password: data.adminPassword,
        },
      };

      const res = await fetch("/api/onboarding/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json() as { success: boolean; slug?: string; error?: string };

      if (!json.success) throw new Error(json.error ?? "Registration failed");

      setCreatedSlug(json.slug ?? data.slug);
      setDone(true);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4 py-16">
        <div className="w-full max-w-md rounded-xl border border-border-primary bg-surface-primary p-8 shadow-sm">
          <SuccessScreen slug={createdSlug} />
        </div>
      </div>
    );
  }

  const stepTitles: Record<number, { heading: string; sub: string }> = {
    1: { heading: "Name your clinic", sub: "This sets up your unique URL and patient ID format" },
    2: { heading: "Contact details", sub: "How patients and staff can reach you" },
    3: { heading: "Upload a logo", sub: "Optional — you can add this later in settings" },
    4: { heading: "Create your admin account", sub: "This is how you'll sign in to the dashboard" },
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex mb-6">
            <Image src="/logo.png" alt="HealthHub" width={160} height={44} className="h-11 w-auto" priority />
          </div>
          <h1 className="text-heading-1 font-bold text-text-primary">{stepTitles[step].heading}</h1>
          <p className="text-body-sm text-text-secondary mt-1">{stepTitles[step].sub}</p>
        </div>

        <div className="rounded-xl border border-border-primary bg-surface-primary p-8 shadow-sm">
          <StepProgress currentStep={step} />

          {/* Step content */}
          <div className="min-h-[280px]">
            {step === 1 && (
              <StepClinicIdentity
                data={data}
                update={update}
                slugStatus={slugStatus}
                slugMessage={slugMessage}
              />
            )}
            {step === 2 && <StepContact data={data} update={update} />}
            {step === 3 && <StepLogo data={data} update={update} />}
            {step === 4 && <StepAdmin data={data} update={update} />}
          </div>

          {/* Errors */}
          {(stepError || globalError) && (
            <div className="mt-4">
              <Alert variant="error">{stepError ?? globalError}</Alert>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between">
            {step > 1 ? (
              <Button variant="secondary" onClick={goBack} disabled={submitting}>
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <div className="flex items-center gap-3">
                {step === 3 && (
                  <button
                    type="button"
                    onClick={goNext}
                    className="text-sm text-text-hint hover:text-text-secondary transition-colors"
                  >
                    Skip for now
                  </button>
                )}
                <Button onClick={goNext}>Continue</Button>
              </div>
            ) : (
              <Button
                onClick={handleSubmit}
                loading={submitting}
                loadingText="Creating clinic…"
              >
                Create clinic
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-text-tertiary mt-6">
          Already have an account?{" "}
          <a href="/admin/login" className="text-text-link hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
