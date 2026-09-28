"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Alert, Button, FormField, Input } from "@/components/ui";
import type { ApiJson } from "@/types/api";

interface BusinessHoursSession {
  start: string;
  end: string;
}

interface ClinicAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  pincode: string;
}

interface ClinicSettings {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  timezone: string;
  address: ClinicAddress | null;
  phones: string[];
  email: string | null;
  website: string | null;
  logo: string | null;
  businessHours: BusinessHoursSession[] | null;
  slotDuration: number | null;
  isActive: boolean;
}

// --- Helper: build empty address ---
function emptyAddress(): ClinicAddress {
  return { line1: "", line2: "", city: "", state: "", pincode: "" };
}

// --- Logo uploader ---
function LogoUploader({
  currentLogo,
  onUpdate,
}: {
  currentLogo: string | null;
  onUpdate: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogo);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setUploading(true);
    setPreview(URL.createObjectURL(file));

    try {
      const fd = new FormData();
      fd.append("logo", file);
      const res = await fetch("/api/clinic/logo", { method: "POST", body: fd });
      const data = (await res.json()) as ApiJson & { logo: string | null };
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        setPreview(currentLogo);
        return;
      }
      onUpdate(data.logo);
      setPreview(data.logo);
    } catch {
      setError("Network error. Please try again.");
      setPreview(currentLogo);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setError("");
    setUploading(true);
    try {
      const res = await fetch("/api/clinic/logo", { method: "DELETE" });
      if (!res.ok) {
        const d = (await res.json()) as ApiJson;
        setError(d.error ?? "Failed to remove logo.");
        return;
      }
      setPreview(null);
      onUpdate(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-secondary">Clinic Logo</label>

      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-primary bg-surface-secondary">
          {preview ? (
            <img src={preview} alt="Logo" className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-2xl text-text-hint">🏥</span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Uploading…" : preview ? "Change Logo" : "Upload Logo"}
            </Button>
            {preview && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={handleRemove}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-text-hint">JPEG, PNG, WebP or SVG. Max 2 MB.</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      {error && <p className="text-sm text-text-error">{error}</p>}
    </div>
  );
}

// --- Business hours editor ---
function BusinessHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: BusinessHoursSession[];
  onChange: (sessions: BusinessHoursSession[]) => void;
  disabled: boolean;
}) {
  function update(i: number, field: "start" | "end", val: string) {
    const next = value.map((s, idx) => (idx === i ? { ...s, [field]: val } : s));
    onChange(next);
  }

  function addSession() {
    if (value.length >= 4) return;
    onChange([...value, { start: "09:00", end: "17:00" }]);
  }

  function removeSession(i: number) {
    if (value.length <= 1) return;
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-secondary">
        Business Hours
        <span className="ml-1 text-xs text-text-hint font-normal">(up to 4 sessions per day)</span>
      </label>

      <div className="space-y-2">
        {value.map((session, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 shrink-0 text-center text-xs text-text-hint">{i + 1}.</span>
            <input
              type="time"
              value={session.start}
              onChange={(e) => update(i, "start", e.target.value)}
              disabled={disabled}
              className="w-28 rounded-md border border-border-primary bg-surface-primary px-2 py-1.5 text-sm text-text-primary disabled:opacity-50"
            />
            <span className="text-xs text-text-hint">to</span>
            <input
              type="time"
              value={session.end}
              onChange={(e) => update(i, "end", e.target.value)}
              disabled={disabled}
              className="w-28 rounded-md border border-border-primary bg-surface-primary px-2 py-1.5 text-sm text-text-primary disabled:opacity-50"
            />
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => removeSession(i)}
                disabled={disabled}
                className="ml-1 rounded px-1.5 py-1 text-xs text-text-error hover:bg-surface-error/10 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>

      {value.length < 4 && (
        <button
          type="button"
          onClick={addSession}
          disabled={disabled}
          className="mt-1 rounded px-2 py-1 text-xs font-medium text-text-brand hover:bg-surface-brand-subtle disabled:opacity-50"
        >
          + Add session
        </button>
      )}
    </div>
  );
}

// --- Phone list editor ---
function PhoneListEditor({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (phones: string[]) => void;
  disabled: boolean;
}) {
  function update(i: number, val: string) {
    onChange(value.map((p, idx) => (idx === i ? val : p)));
  }

  function add() {
    if (value.length >= 5) return;
    onChange([...value, ""]);
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-secondary">Phone Numbers</label>
      <div className="space-y-2">
        {value.map((phone, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="tel"
              value={phone}
              onChange={(e) => update(i, e.target.value)}
              disabled={disabled}
              placeholder="10-digit mobile number"
              maxLength={15}
            />
            {value.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                className="shrink-0 rounded px-2 py-1 text-xs text-text-error hover:bg-surface-error/10 disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      {value.length < 5 && (
        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="mt-1 rounded px-2 py-1 text-xs font-medium text-text-brand hover:bg-surface-brand-subtle disabled:opacity-50"
        >
          + Add number
        </button>
      )}
    </div>
  );
}

// --- Section wrapper ---
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border-primary bg-surface-primary p-5 space-y-4">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  );
}

// --- Main ClinicSettingsTab ---
export default function ClinicSettingsTab() {
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // Per-section editable state
  const [identity, setIdentity] = useState({ name: "", shortName: "" });
  const [contact, setContact] = useState({
    phones: [""],
    email: "",
    website: "",
  });
  const [address, setAddress] = useState<ClinicAddress>(emptyAddress());
  const [schedule, setSchedule] = useState({
    timezone: "Asia/Kolkata",
    businessHours: [
      { start: "10:00", end: "14:00" },
      { start: "16:00", end: "22:00" },
    ] as BusinessHoursSession[],
    slotDuration: 30,
  });

  // Per-section save state
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saveError, setSaveError] = useState<Record<string, string>>({});
  const [saveSuccess, setSaveSuccess] = useState<Record<string, boolean>>({});

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setFetchError("");
    try {
      const res = await fetch("/api/clinic/settings");
      const data = (await res.json()) as ApiJson & { clinic: ClinicSettings };
      if (!res.ok || !data.success) {
        setFetchError(data.error ?? "Failed to load settings.");
        return;
      }
      const s: ClinicSettings = data.clinic;
      setSettings(s);
      setIdentity({ name: s.name, shortName: s.shortName });
      setContact({
        phones: s.phones.length > 0 ? s.phones : [""],
        email: s.email ?? "",
        website: s.website ?? "",
      });
      setAddress(s.address ?? emptyAddress());
      setSchedule({
        timezone: s.timezone,
        businessHours: (s.businessHours as BusinessHoursSession[] | null) ?? [
          { start: "10:00", end: "14:00" },
          { start: "16:00", end: "22:00" },
        ],
        slotDuration: s.slotDuration ?? 30,
      });
    } catch {
      setFetchError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function save(section: string, payload: Record<string, unknown>) {
    setSaving((prev) => ({ ...prev, [section]: true }));
    setSaveError((prev) => ({ ...prev, [section]: "" }));
    setSaveSuccess((prev) => ({ ...prev, [section]: false }));

    try {
      const res = await fetch("/api/clinic/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ApiJson & { clinic: ClinicSettings };
      if (!res.ok || !data.success) {
        setSaveError((prev) => ({ ...prev, [section]: data.error ?? "Failed to save." }));
        return;
      }
      setSaveSuccess((prev) => ({ ...prev, [section]: true }));
      setTimeout(() => setSaveSuccess((prev) => ({ ...prev, [section]: false })), 3000);

      // Refresh settings to sync any derived values
      const s: ClinicSettings = data.clinic;
      setSettings(s);
    } catch {
      setSaveError((prev) => ({ ...prev, [section]: "Network error. Please try again." }));
    } finally {
      setSaving((prev) => ({ ...prev, [section]: false }));
    }
  }

  function SaveButton({ section }: { section: string }) {
    return (
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={saving[section]}
          loading={saving[section]}
          loadingText="Saving…"
          onClick={() => {
            if (section === "identity") save("identity", identity);
            if (section === "contact")
              save("contact", {
                phones: contact.phones.filter((p) => p.trim() !== ""),
                email: contact.email.trim() || null,
                website: contact.website.trim() || null,
              });
            if (section === "address")
              save("address", {
                address:
                  address.line1.trim() && address.city.trim()
                    ? {
                        line1: address.line1.trim(),
                        line2: address.line2?.trim() || null,
                        city: address.city.trim(),
                        state: address.state.trim(),
                        pincode: address.pincode.trim(),
                      }
                    : null,
              });
            if (section === "schedule") save("schedule", schedule);
          }}
        >
          Save
        </Button>
        {saveSuccess[section] && (
          <span className="text-sm text-text-success">Saved!</span>
        )}
        {saveError[section] && (
          <span className="text-sm text-text-error">{saveError[section]}</span>
        )}
      </div>
    );
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-text-hint">Loading settings…</div>;
  }

  if (fetchError) {
    return (
      <Alert variant="error">{fetchError}</Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo */}
      <Section title="Logo">
        <LogoUploader
          currentLogo={settings?.logo ?? null}
          onUpdate={(url) => setSettings((prev) => prev ? { ...prev, logo: url } : prev)}
        />
      </Section>

      {/* Identity */}
      <Section title="Clinic Identity">
        <div className="space-y-3">
          <FormField label="Clinic Name" htmlFor="clinic-name">
            <Input
              id="clinic-name"
              type="text"
              value={identity.name}
              onChange={(e) => setIdentity((p) => ({ ...p, name: e.target.value }))}
              maxLength={200}
              disabled={saving["identity"]}
            />
          </FormField>

          <FormField label="Short Name (Patient ID Prefix)" htmlFor="clinic-short-name" hint="Uppercase, e.g. DDCJ">
            <Input
              id="clinic-short-name"
              type="text"
              value={identity.shortName}
              onChange={(e) =>
                setIdentity((p) => ({ ...p, shortName: e.target.value.toUpperCase() }))
              }
              maxLength={20}
              disabled={saving["identity"]}
            />
          </FormField>

          <div>
            <p className="text-xs text-text-hint">
              Subdomain: <span className="font-mono">{settings?.slug}.healthhub.app</span> (cannot be changed)
            </p>
          </div>
        </div>
        <SaveButton section="identity" />
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <div className="space-y-3">
          <PhoneListEditor
            value={contact.phones}
            onChange={(phones) => setContact((p) => ({ ...p, phones }))}
            disabled={saving["contact"]}
          />

          <FormField label="Email" htmlFor="clinic-email" hint="Optional">
            <Input
              id="clinic-email"
              type="email"
              value={contact.email}
              onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
              placeholder="clinic@example.com"
              disabled={saving["contact"]}
            />
          </FormField>

          <FormField label="Website" htmlFor="clinic-website" hint="Optional">
            <Input
              id="clinic-website"
              type="url"
              value={contact.website}
              onChange={(e) => setContact((p) => ({ ...p, website: e.target.value }))}
              placeholder="https://yourclinic.com"
              disabled={saving["contact"]}
            />
          </FormField>
        </div>
        <SaveButton section="contact" />
      </Section>

      {/* Address */}
      <Section title="Address">
        <div className="space-y-3">
          <FormField label="Line 1" htmlFor="addr-line1">
            <Input
              id="addr-line1"
              type="text"
              value={address.line1}
              onChange={(e) => setAddress((p) => ({ ...p, line1: e.target.value }))}
              placeholder="Street address"
              maxLength={200}
              disabled={saving["address"]}
            />
          </FormField>

          <FormField label="Line 2" htmlFor="addr-line2" hint="Optional">
            <Input
              id="addr-line2"
              type="text"
              value={address.line2 ?? ""}
              onChange={(e) => setAddress((p) => ({ ...p, line2: e.target.value }))}
              placeholder="Apartment, suite, etc."
              maxLength={200}
              disabled={saving["address"]}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="City" htmlFor="addr-city">
              <Input
                id="addr-city"
                type="text"
                value={address.city}
                onChange={(e) => setAddress((p) => ({ ...p, city: e.target.value }))}
                maxLength={100}
                disabled={saving["address"]}
              />
            </FormField>

            <FormField label="State" htmlFor="addr-state">
              <Input
                id="addr-state"
                type="text"
                value={address.state}
                onChange={(e) => setAddress((p) => ({ ...p, state: e.target.value }))}
                maxLength={100}
                disabled={saving["address"]}
              />
            </FormField>
          </div>

          <FormField label="Pincode" htmlFor="addr-pincode">
            <Input
              id="addr-pincode"
              type="text"
              value={address.pincode}
              onChange={(e) => setAddress((p) => ({ ...p, pincode: e.target.value }))}
              maxLength={10}
              disabled={saving["address"]}
            />
          </FormField>
        </div>
        <SaveButton section="address" />
      </Section>

      {/* Schedule */}
      <Section title="Schedule">
        <div className="space-y-4">
          <FormField label="Timezone" htmlFor="clinic-timezone">
            <select
              id="clinic-timezone"
              value={schedule.timezone}
              onChange={(e) => setSchedule((p) => ({ ...p, timezone: e.target.value }))}
              disabled={saving["schedule"]}
              className="w-full rounded-md border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary disabled:opacity-50"
            >
              <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
              <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
              <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
              <option value="Asia/Colombo">Asia/Colombo (SLST, UTC+5:30)</option>
              <option value="Asia/Dhaka">Asia/Dhaka (BST, UTC+6)</option>
              <option value="Asia/Karachi">Asia/Karachi (PKT, UTC+5)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="America/New_York">America/New_York (ET)</option>
              <option value="America/Chicago">America/Chicago (CT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
            </select>
          </FormField>

          <BusinessHoursEditor
            value={schedule.businessHours}
            onChange={(bh) => setSchedule((p) => ({ ...p, businessHours: bh }))}
            disabled={saving["schedule"]}
          />

          <FormField label="Slot Duration (minutes)" htmlFor="slot-duration">
            <select
              id="slot-duration"
              value={schedule.slotDuration}
              onChange={(e) =>
                setSchedule((p) => ({ ...p, slotDuration: Number(e.target.value) }))
              }
              disabled={saving["schedule"]}
              className="w-full rounded-md border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary disabled:opacity-50"
            >
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={20}>20 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </FormField>
        </div>
        <SaveButton section="schedule" />
      </Section>
    </div>
  );
}
