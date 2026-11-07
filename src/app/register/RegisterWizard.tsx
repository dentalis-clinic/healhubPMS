"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { Button, Input, FormField, Alert } from "@/components/ui";
import { APP_DOMAIN, isTestHost } from "@/lib/constants/app";

// Signup asks only for what can't easily change later (subdomain, patient ID
// prefix) and the admin account. Contact details, address, logo and hours are
// added from the dashboard, where the setup checklist lists what's left.

const STEPS = [
  { id: 1, label: "Clinic" },
  { id: 2, label: "Your account" },
];
const LAST_STEP = STEPS.length;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** "Mentalis" → "MENT", "Dentalis Dental Care" → "DDC". Always 2+ characters when possible. */
function toPrefix(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "";
  const initials = words.map((w) => w[0]).join("").slice(0, 8);
  return initials.length >= 2 ? initials : words[0].slice(0, 4);
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

// ── Types ────────────────────────────────────────────────────────────────────

type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface WizardData {
  name: string;
  shortName: string;
  slug: string;
  timezone: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  adminPasswordConfirm: string;
}

const initialData: WizardData = {
  name: "",
  shortName: "",
  slug: "",
  timezone: "Asia/Kolkata",
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
    update({ name, shortName: toPrefix(name), slug: toSlug(name) });
  }

  const slugIndicator = {
    idle: null,
    checking: (
      <span className="text-text-hint text-xs">Checking availability…</span>
    ),
    available: (
      <span className="text-text-success text-xs flex items-center gap-1">
        <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm3.354 5.146a.5.5 0 0 0-.708 0L7 9.793 5.354 8.146a.5.5 0 1 0-.708.708l2 2a.5.5 0 0 0 .708 0l4-4a.5.5 0 0 0 0-.708z" />
        </svg>
        Available
      </span>
    ),
    taken: (
      <span className="text-text-error text-xs flex items-center gap-1">
        <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
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
      <FormField label="Clinic name" htmlFor="name" hint="The name patients know you by">
        <Input
          id="name"
          value={data.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Dentalis Dental Care"
          autoFocus
        />
      </FormField>

      <FormField label="Subdomain" htmlFor="slug" hint="Your booking link. It can't be changed later.">
        <Input
          id="slug"
          value={data.slug}
          onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30) })}
          placeholder="dentalis"
          className="font-mono"
          autoCapitalize="none"
          spellCheck={false}
        />
      </FormField>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border-primary bg-surface-brand px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs text-text-secondary font-medium">Your booking link</p>
          <p className="text-sm font-mono text-text-brand mt-0.5 truncate">
            {data.slug ? (
              <span>
                <span className="text-text-primary font-semibold">{data.slug}</span>
                <span className="text-text-hint">.{APP_DOMAIN}</span>
              </span>
            ) : (
              <span className="text-text-hint">yourclinic.{APP_DOMAIN}</span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">{slugIndicator}</div>
      </div>

      <FormField
        label="Patient ID prefix"
        htmlFor="shortName"
        hint={`Starts every patient ID, e.g. ${data.shortName || "DDC"}-20261107-0001. Changing it later leaves older IDs with the old prefix.`}
      >
        <Input
          id="shortName"
          value={data.shortName}
          onChange={(e) => update({ shortName: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) })}
          placeholder="DDC"
          className="font-mono w-40"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </FormField>
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
          autoComplete="name"
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
          autoComplete="email"
          spellCheck={false}
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
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
        <p className="text-xs font-semibold text-text-secondary uppercase">Summary</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-text-hint">Clinic</dt>
          <dd className="text-text-primary font-medium truncate">{data.name || "—"}</dd>
          <dt className="text-text-hint">Booking link</dt>
          <dd className="text-text-primary font-mono truncate">{data.slug ? `${data.slug}.${APP_DOMAIN}` : "—"}</dd>
          <dt className="text-text-hint">Prefix</dt>
          <dd className="text-text-primary font-mono">{data.shortName || "—"}</dd>
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
                className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                  done
                    ? "bg-interactive-primary text-text-inverse"
                    : active
                    ? "border-2 border-interactive-primary text-text-brand bg-surface-brand"
                    : "border-2 border-border-primary text-text-tertiary bg-surface-primary"
                }`}
              >
                {done ? (
                  <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
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
        <div className="size-16 rounded-full bg-surface-success flex items-center justify-center">
          <svg className="size-8 text-text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
      </div>
      <div>
        <h2 className="text-heading-2 font-bold text-balance text-text-primary">Your clinic is live</h2>
        <p className="text-body-sm text-pretty text-text-secondary mt-2">
          Sign in to finish setting up. Your dashboard lists what&apos;s left to add, like your phone
          number, opening hours and logo.
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
        Sign in to continue
        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
    if (data.slug.length < 3) return "Subdomain must be at least 3 characters";
    if (slugStatus === "taken") return "This subdomain is already taken";
    if (slugStatus === "invalid") return "Subdomain format is invalid";
    if (slugStatus === "checking") return "Please wait while we check the subdomain";
    if (data.shortName.length < 2) return "Patient ID prefix must be at least 2 characters";
    return null;
  }
  if (step === 2) {
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
    setGlobalError(null);
    setStep((s) => s - 1);
  }

  async function handleSubmit() {
    const err = validateStep(LAST_STEP, data, slugStatus);
    if (err) {
      setStepError(err);
      return;
    }

    setSubmitting(true);
    setGlobalError(null);

    try {
      const res = await fetch("/api/onboarding/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic: {
            name: data.name,
            shortName: data.shortName,
            slug: data.slug,
            timezone: data.timezone,
          },
          admin: {
            name: data.adminName,
            email: data.adminEmail,
            password: data.adminPassword,
          },
        }),
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
      <div className="flex min-h-dvh items-center justify-center bg-surface-secondary px-4 py-16">
        <div className="w-full max-w-md rounded-xl border border-border-primary bg-surface-primary p-8 shadow-sm">
          <SuccessScreen slug={createdSlug} />
        </div>
      </div>
    );
  }

  const stepTitles: Record<number, { heading: string; sub: string }> = {
    1: { heading: "Name your clinic", sub: "This sets your booking link and patient ID format" },
    2: { heading: "Create your admin account", sub: "You'll add the rest of your clinic's details from the dashboard" },
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-secondary px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex mb-6">
            <Image src="/logo.png" alt="HealthHub" width={160} height={44} className="h-11 w-auto" priority />
          </div>
          <h1 className="text-heading-1 font-bold text-balance text-text-primary">{stepTitles[step].heading}</h1>
          <p className="text-body-sm text-pretty text-text-secondary mt-1">{stepTitles[step].sub}</p>
        </div>

        <div className="rounded-xl border border-border-primary bg-surface-primary p-8 shadow-sm">
          <StepProgress currentStep={step} />

          {/* Step content */}
          <div>
            {step === 1 && (
              <StepClinicIdentity
                data={data}
                update={update}
                slugStatus={slugStatus}
                slugMessage={slugMessage}
              />
            )}
            {step === 2 && <StepAdmin data={data} update={update} />}
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

            {step < LAST_STEP ? (
              <Button onClick={goNext}>Continue</Button>
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
