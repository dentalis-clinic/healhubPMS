import { redirect } from "next/navigation";
import { fetchAppointments } from "@/lib/data/dashboard";
import { getClinicForPage } from "@/lib/utils/get-clinic-for-page";
import AppointmentsView from "@/components/admin/AppointmentsView";

export default async function AppointmentsPage() {
  const clinic = await getClinicForPage();
  if (!clinic) redirect("/admin/login");

  const { appointments, total } = await fetchAppointments("all", clinic.id, clinic.timezone ?? "Asia/Kolkata");
  return <AppointmentsView initialAppointments={appointments} initialTotal={total} />;
}
