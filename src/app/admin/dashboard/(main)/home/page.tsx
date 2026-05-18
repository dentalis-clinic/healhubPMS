import { redirect } from "next/navigation";
import { fetchDashboardStats, fetchAppointments } from "@/lib/data/dashboard";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";
import DashboardHome from "@/components/admin/DashboardHome";

export default async function HomePage() {
  const clinic = await getClinicForPage();
  if (!clinic) redirect("/admin/login");

  const [stats, { appointments }] = await Promise.all([
    fetchDashboardStats(clinic.id, clinic.timezone ?? "Asia/Kolkata"),
    fetchAppointments("today", clinic.id, clinic.timezone ?? "Asia/Kolkata"),
  ]);

  return <DashboardHome initialStats={stats} initialAppointments={appointments} />;
}
