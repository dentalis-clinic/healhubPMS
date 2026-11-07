import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchDashboardStats, fetchAppointments } from "@/lib/data/dashboard";
import { getClinicForPage, type ClinicInfo } from "@/lib/utils/get-clinic-for-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_DOMAIN, isTestHost } from "@/lib/constants/app";
import { SETUP_HIDDEN_COOKIE } from "@/lib/constants/setup";
import DashboardHome from "@/components/admin/DashboardHome";
import SetupChecklist, { type SetupItem } from "@/components/admin/SetupChecklist";

export default async function HomePage() {
  const clinic = await getClinicForPage();
  if (!clinic) redirect("/admin/login");

  const timezone = clinic.timezone ?? "Asia/Kolkata";
  const [stats, { appointments }, setup] = await Promise.all([
    fetchDashboardStats(clinic.id, timezone),
    fetchAppointments("today", clinic.id, timezone),
    getSetupChecklist(clinic),
  ]);

  return (
    <div className="space-y-6">
      {setup && <SetupChecklist bookingUrl={setup.bookingUrl} items={setup.items} />}
      <DashboardHome initialStats={stats} initialAppointments={appointments} />
    </div>
  );
}

/**
 * The checklist's items, each worked out from the clinic's data. Returns null
 * when everything is done or the list was hidden. It's a convenience, so a
 * failed lookup hides it rather than breaking the dashboard.
 */
async function getSetupChecklist(
  clinic: ClinicInfo
): Promise<{ bookingUrl: string; items: SetupItem[] } | null> {
  const [cookieStore, h] = await Promise.all([cookies(), headers()]);
  if (cookieStore.get(SETUP_HIDDEN_COOKIE)) return null;

  const supabase = createAdminClient();
  const [clinicResult, doctorsResult] = await Promise.all([
    supabase.from("clinics").select("slug, businessHours").eq("id", clinic.id).single(),
    supabase.from("doctors").select("id", { count: "exact", head: true }).eq("clinicId", clinic.id),
  ]);
  if (clinicResult.error || doctorsResult.error) {
    console.error("[setup-checklist]", clinicResult.error ?? doctorsResult.error);
    return null;
  }

  const clinicTab = "/admin/dashboard/settings?tab=clinic";
  // Ordered by what patients notice first.
  const items: SetupItem[] = [
    {
      key: "phone",
      label: "Add a phone number",
      detail: "Shown on your booking page so patients can call you.",
      done: clinic.phones.length > 0,
      href: clinicTab,
      action: "Add",
    },
    {
      key: "hours",
      label: "Set your opening hours",
      detail: "Until you do, patients can book 10 am–2 pm and 4–10 pm.",
      done: clinicResult.data.businessHours !== null,
      href: clinicTab,
      action: "Set hours",
    },
    {
      key: "logo",
      label: "Upload your logo",
      detail: "Appears on your booking page and printed prescriptions.",
      done: clinic.logo !== null,
      href: clinicTab,
      action: "Upload",
    },
    {
      key: "address",
      label: "Add your address",
      detail: "Printed on prescriptions and other documents.",
      done: clinic.address !== null,
      href: clinicTab,
      action: "Add",
    },
    {
      key: "doctor",
      label: "Add a doctor",
      detail: "So you can assign appointments to a doctor, and their name prints on prescriptions.",
      done: (doctorsResult.count ?? 0) > 0,
      href: "/admin/dashboard/settings?tab=doctors",
      action: "Add doctor",
    },
  ];
  if (items.every((i) => i.done)) return null;

  // Test hosts (localhost, *.workers.dev) serve one clinic on their own origin.
  const rawHost = h.get("host") ?? "";
  const host = rawHost.split(":")[0];
  const bookingUrl = isTestHost(host)
    ? `${h.get("x-forwarded-proto") ?? (host === "localhost" || host === "127.0.0.1" ? "http" : "https")}://${rawHost}/`
    : `https://${clinicResult.data.slug}.${APP_DOMAIN}/`;

  return { bookingUrl, items };
}
